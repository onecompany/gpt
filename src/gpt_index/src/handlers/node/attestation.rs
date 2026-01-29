use crate::storage::CONFIG;
use gpt_types::{
    api::{
        GetAttestationRequirementsRequest, GetAttestationRequirementsResponse,
        GetAttestationRequirementsResult,
    },
    domain::node::{AttestationRequirements, MeasurementStatus},
    error::CanisterError,
};
use hex;
use ic_cdk_macros::query;
use p384::ecdsa::{Signature as P384Signature, VerifyingKey, signature::hazmat::PrehashVerifier};
use sev::certs::snp::{Certificate, Verifiable};
use sev::firmware::{
    guest::{AttestationReport, PlatformInfo},
    host::TcbVersion as HostTcbVersion,
};
use sha2::{Digest, Sha384};

pub(super) const P384_SCALAR_SIZE: usize = 48;
pub(super) const SIGNED_DATA_LEN: usize = 672;
pub(super) const CHIP_ID_HEX_LENGTH: usize = 128;

pub(super) fn verify_attestation_evidence(
    report_bytes: &[u8],
    report: &AttestationReport,
    ark: &Certificate,
    ask: &Certificate,
    vek: &Certificate,
    requirements: &AttestationRequirements,
    expected_report_data: &[u8; 64],
) -> Result<String, String> {
    ic_cdk::println!("Performing full attestation evidence verification...");

    ic_cdk::println!("  - Verifying certificate chain...");
    match (
        (ark, ark).verify(),
        (ark, ask).verify(),
        (ask, vek).verify(),
    ) {
        (Ok(_), Ok(_), Ok(_)) => ic_cdk::println!("    Certificate chain verified."),
        (Err(e), _, _) => return Err(format!("ARK self-signed check failed: {}", e)),
        (_, Err(e), _) => return Err(format!("ARK -> ASK signature check failed: {}", e)),
        (_, _, Err(e)) => return Err(format!("ASK -> VEK signature check failed: {}", e)),
    }

    ic_cdk::println!("  - Verifying report signature...");
    verify_report_signature_manually(report_bytes, report, vek)?;
    ic_cdk::println!("    Report signature verified.");

    if report.report_data != *expected_report_data {
        return Err("Report Data mismatch. Replay attack or invalid nonce.".to_string());
    }

    ic_cdk::println!("  - Verifying report content and generation...");
    let generation = detect_generation_from_report(report);
    perform_attestation_checks(report, requirements, generation)?;
    ic_cdk::println!("    Report content verified for generation {}.", generation);

    ic_cdk::println!("Attestation evidence verification successful.");
    Ok(generation.to_string())
}

fn detect_generation_from_report(report: &AttestationReport) -> &'static str {
    if report.reported_tcb.fmc.is_some() {
        return "Turin";
    }
    "Milan"
}

fn verify_report_signature_manually(
    report_bytes: &[u8],
    report: &AttestationReport,
    vek: &Certificate,
) -> Result<(), String> {
    let vek_pubkey_sec1 = vek.public_key_sec1();
    let encoded_point = p384::EncodedPoint::from_bytes(vek_pubkey_sec1)
        .map_err(|e| format!("Failed to parse VEK pubkey SEC1 bytes: {:?}", e))?;
    let verifying_key = VerifyingKey::from_encoded_point(&encoded_point)
        .map_err(|e| format!("Failed to create P-384 verifying key from point: {:?}", e))?;

    if report_bytes.len() < SIGNED_DATA_LEN {
        return Err(format!(
            "Report too short for signature ({} < {} bytes)",
            report_bytes.len(),
            SIGNED_DATA_LEN
        ));
    }
    let report_body_bytes = &report_bytes[..SIGNED_DATA_LEN];
    let mut hasher = Sha384::new();
    hasher.update(report_body_bytes);
    let digest = hasher.finalize();

    let r_bytes = report.signature.r();
    let s_bytes = report.signature.s();

    if r_bytes.len() < P384_SCALAR_SIZE || s_bytes.len() < P384_SCALAR_SIZE {
        return Err(format!(
            "Report signature components R/S length less than expected {} bytes",
            P384_SCALAR_SIZE
        ));
    }
    let sig_r_le = &r_bytes[..P384_SCALAR_SIZE];
    let sig_s_le = &s_bytes[..P384_SCALAR_SIZE];

    let mut sig_r_be_bytes = [0u8; P384_SCALAR_SIZE];
    sig_r_be_bytes.copy_from_slice(sig_r_le);
    sig_r_be_bytes.reverse();

    let mut sig_s_be_bytes = [0u8; P384_SCALAR_SIZE];
    sig_s_be_bytes.copy_from_slice(sig_s_le);
    sig_s_be_bytes.reverse();

    let signature = P384Signature::from_scalars(sig_r_be_bytes, sig_s_be_bytes).map_err(|e| {
        format!(
            "Failed to create p384 signature object from scalars: {:?}",
            e
        )
    })?;

    verifying_key
        .verify_prehash(&digest, &signature)
        .map_err(|e| format!("Report signature verification failed: {}", e))?;

    Ok(())
}

fn perform_attestation_checks(
    report: &AttestationReport,
    requirements: &AttestationRequirements,
    generation: &str,
) -> Result<(), String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Measurement Check against Registry
    let reported_hex = hex::encode(report.measurement.as_slice());

    // Iterate over allowed measurements
    let matched = requirements
        .measurements
        .iter()
        .find(|m| m.measurement_hex == reported_hex);

    match matched {
        Some(m) => {
            if m.status != MeasurementStatus::Active {
                errors.push(format!(
                    "Measurement {} is not Active (Status: {:?})",
                    reported_hex, m.status
                ));
            } else {
                ic_cdk::println!("    Measurement matched: {} ({})", m.name, reported_hex);
            }
        }
        None => {
            errors.push(format!(
                "Reported measurement {} not found in allowed registry",
                reported_hex
            ));
        }
    }

    if report.version < requirements.min_report_version {
        errors.push(format!(
            "Report version {} < min {}",
            report.version, requirements.min_report_version
        ));
    }

    let tcb: HostTcbVersion = report.reported_tcb;
    let gen_policy = match generation {
        "Milan" => &requirements.milan_policy,
        "Genoa" => &requirements.genoa_policy,
        "Turin" => &requirements.turin_policy,
        _ => &requirements.milan_policy,
    };

    if report.guest_svn < gen_policy.min_guest_svn {
        errors.push(format!(
            "Guest SVN {} < min {}",
            report.guest_svn, gen_policy.min_guest_svn
        ));
    }

    let min_tcb = &gen_policy.min_tcb;

    if tcb.microcode < min_tcb.microcode {
        errors.push(format!(
            "TCB Microcode {} < min {}",
            tcb.microcode, min_tcb.microcode
        ));
    }
    if tcb.snp < min_tcb.snp {
        errors.push(format!("TCB SNP {} < min {}", tcb.snp, min_tcb.snp));
    }
    if tcb.tee < min_tcb.tee {
        errors.push(format!("TCB TEE {} < min {}", tcb.tee, min_tcb.tee));
    }
    if tcb.bootloader < min_tcb.bootloader {
        errors.push(format!(
            "TCB Bootloader {} < min {}",
            tcb.bootloader, min_tcb.bootloader
        ));
    }
    if generation == "Turin"
        && let Some(fmc) = tcb.fmc
        && fmc < min_tcb.fmc
    {
        errors.push(format!("TCB FMC {} < min {}", fmc, min_tcb.fmc));
    }

    let plat_info: PlatformInfo = report.plat_info;

    if requirements.require_smt_disabled && plat_info.smt_enabled() {
        errors.push("SMT enabled, required disabled".to_string());
    }
    if requirements.require_tsme_disabled && plat_info.tsme_enabled() {
        errors.push("TSME enabled, required disabled".to_string());
    }
    if requirements.require_ecc_enabled && !plat_info.ecc_enabled() {
        errors.push("ECC disabled, required enabled".to_string());
    }

    if requirements.require_rapl_disabled && !plat_info.rapl_disabled() {
        warnings.push("RAPL enabled, required disabled (WARN)".to_string());
    }

    if !errors.is_empty() {
        let error_summary = errors.join("; ");
        ic_cdk::println!("FAIL: Attestation checks failed: {}", error_summary);
        Err(error_summary)
    } else {
        ic_cdk::println!("PASS: All mandatory attestation checks passed.");
        if !warnings.is_empty() {
            ic_cdk::println!("WARN: {}", warnings.join("; "));
        }
        Ok(())
    }
}

#[query]
pub fn get_attestation_requirements(
    _req: GetAttestationRequirementsRequest,
) -> GetAttestationRequirementsResult {
    let result = CONFIG.with(|c| {
        let cell_ref = c.borrow();
        let wrapper = cell_ref.get();
        wrapper
            .0
            .attestation_requirements
            .clone()
            .map(|requirements| GetAttestationRequirementsResponse { requirements })
            .ok_or_else(|| {
                CanisterError::Other("Attestation requirements not available.".to_string())
            })
    });
    result.into()
}
