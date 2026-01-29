use super::util::abbreviate_hex;
use anyhow::{Result, anyhow};
use gpt_types::domain::node::AttestationRequirements;
use sev::firmware::{
    guest::{AttestationReport, PlatformInfo},
    host::TcbVersion,
};
use tracing::{error, info, warn};

/// Detects the AMD SEV-SNP generation from TCB values.
/// - Turin: Has FMC field present
/// - Genoa: No FMC, bootloader >= 8 (typically 10)
/// - Milan: No FMC, bootloader < 8 (typically 4)
fn detect_generation(tcb: &TcbVersion) -> &'static str {
    if tcb.fmc.is_some() {
        "Turin"
    } else if tcb.bootloader >= 8 {
        "Genoa"
    } else {
        "Milan"
    }
}

pub(super) fn perform_report_content_checks(
    report: &AttestationReport,
    requirements: &AttestationRequirements,
) -> Result<()> {
    info!("Attestation Report Content Checks (using Index Requirements)");
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    check_measurement(report, requirements)?;
    errors.extend(check_integrity(report, requirements));
    errors.extend(check_versions(report, requirements));
    errors.extend(check_tcb(report, requirements));
    check_platform_info(report, requirements, &mut errors, &mut warnings);

    if !errors.is_empty() {
        let error_summary = errors.join("; ");
        error!(
            num_errors = errors.len(),
            summary = %error_summary,
            "Attestation report content checks failed"
        );
        Err(anyhow!(
            "Attestation report failed mandatory content checks: {}",
            error_summary
        ))
    } else {
        info!("PASS: All mandatory attestation report content checks passed.");
        if !warnings.is_empty() {
            warn!("WARN: Informational warnings: {}", warnings.join("; "));
        }
        Ok(())
    }
}

fn check_measurement(
    report: &AttestationReport,
    requirements: &AttestationRequirements,
) -> Result<()> {
    // Check if the measurement exists in the list of allowed measurements
    let reported_hex = hex::encode(report.measurement.as_slice());

    info!(
        reported = %abbreviate_hex(&reported_hex, 16),
        "Verifying measurement against registry..."
    );

    // We check if the reported measurement is present in the allowed list.
    // Note: The node doesn't strictly check for 'Active' status here;
    // the Index enforces that during registration. The node just verifies it's a known measurement.
    let is_valid = requirements
        .measurements
        .iter()
        .any(|m| m.measurement_hex == reported_hex);

    if !is_valid {
        let err_msg = format!(
            "Measurement mismatch. Reported measurement {} not found in allowed registry.",
            &reported_hex[..16]
        );
        error!(details = %err_msg, "Critical measurement check failed");
        Err(anyhow!(err_msg))
    } else {
        info!("PASS: Measurement matches a known registry entry.");
        Ok(())
    }
}

fn check_integrity(
    report: &AttestationReport,
    requirements: &AttestationRequirements,
) -> Vec<String> {
    let mut errors = Vec::new();
    if report.version == 0 {
        errors.push("Report version is zero".to_string());
    }
    if report.chip_id.iter().all(|&b| b == 0) {
        errors.push("Chip ID is all zeros".to_string());
    }
    if report.measurement.len() as u64 != requirements.expected_measurement_len {
        errors.push(format!(
            "Measurement length is {} not required {}",
            report.measurement.len(),
            requirements.expected_measurement_len
        ));
    }
    if report.signature == Default::default() {
        errors.push("Signature is default".to_string());
    }
    if report.report_id.iter().all(|&b| b == 0) {
        errors.push("Report ID is all zeros".to_string());
    }

    if errors.is_empty() {
        info!("PASS: Basic integrity checks passed.");
    } else {
        for err in &errors {
            error!(check = "integrity", details = %err, "Integrity check failed");
        }
    }
    errors
}

fn check_versions(
    report: &AttestationReport,
    requirements: &AttestationRequirements,
) -> Vec<String> {
    let mut errors = Vec::new();
    if report.version < requirements.min_report_version {
        errors.push(format!(
            "Report version {} is below minimum {}",
            report.version, requirements.min_report_version
        ));
    }

    let generation = detect_generation(&report.reported_tcb);
    let gen_policy = match generation {
        "Turin" => &requirements.turin_policy,
        "Genoa" => &requirements.genoa_policy,
        _ => &requirements.milan_policy,
    };

    if report.guest_svn < gen_policy.min_guest_svn {
        errors.push(format!(
            "Guest SVN {} is below minimum {}",
            report.guest_svn, gen_policy.min_guest_svn
        ));
    }

    if errors.is_empty() {
        info!(
            "PASS: Report Version ({}) and Guest SVN ({}) meet minimums.",
            report.version, report.guest_svn
        );
    } else {
        for err in &errors {
            error!(check = "version", details = %err, "Version check failed");
        }
    }
    errors
}

fn check_tcb(report: &AttestationReport, requirements: &AttestationRequirements) -> Vec<String> {
    let mut errors = Vec::new();
    let tcb: TcbVersion = report.reported_tcb;

    let generation = detect_generation(&tcb);
    let gen_policy = match generation {
        "Turin" => &requirements.turin_policy,
        "Genoa" => &requirements.genoa_policy,
        _ => &requirements.milan_policy,
    };

    let min_tcb = &gen_policy.min_tcb;

    info!(
        reported.bootloader = tcb.bootloader,
        reported.tee = tcb.tee,
        reported.snp = tcb.snp,
        reported.microcode = tcb.microcode,
        "Verifying TCB versions..."
    );

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
    if let Some(fmc) = tcb.fmc
        && fmc < min_tcb.fmc
    {
        errors.push(format!("TCB FMC {} < min {}", fmc, min_tcb.fmc));
    }

    if errors.is_empty() {
        info!("PASS: Reported TCB values meet minimums.");
    } else {
        for err in &errors {
            error!(check = "tcb", details = %err, "TCB check failed");
        }
    }
    errors
}

fn check_platform_info(
    report: &AttestationReport,
    requirements: &AttestationRequirements,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    let plat_info: PlatformInfo = report.plat_info;
    let mut platform_mandatory_ok = true;
    info!("Verifying Platform Info flags...");

    if requirements.require_smt_disabled && plat_info.smt_enabled() {
        errors.push("Platform: SMT is enabled, but required disabled".to_string());
        platform_mandatory_ok = false;
    }
    if requirements.require_tsme_disabled && plat_info.tsme_enabled() {
        errors.push("Platform: TSME is enabled, but required disabled".to_string());
        platform_mandatory_ok = false;
    }
    if requirements.require_ecc_enabled && !plat_info.ecc_enabled() {
        errors.push("Platform: ECC is disabled, but required enabled".to_string());
        platform_mandatory_ok = false;
    }

    if platform_mandatory_ok {
        info!("PASS: Mandatory Platform Info checks passed.");
    } else {
        for err in errors.iter().filter(|e| e.starts_with("Platform:")) {
            error!(check = "platform_info", details = %err, "Platform Info check failed");
        }
    }

    if requirements.require_rapl_disabled && !plat_info.rapl_disabled() {
        warnings
            .push("Platform: RAPL is enabled, but required disabled (WARNING ONLY)".to_string());
    }
    if requirements.require_ciphertext_hiding_enabled && !plat_info.ciphertext_hiding_enabled() {
        warnings.push(
            "Platform: Ciphertext Hiding is disabled, but required enabled (WARNING ONLY)"
                .to_string(),
        );
    }
}
