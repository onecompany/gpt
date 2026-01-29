use super::requirements::{P384_SCALAR_SIZE, SIGNED_DATA_LEN};
use super::util::abbreviate_hex;
use anyhow::{Context, Result, anyhow};
use p384::ecdsa::{Signature as P384Signature, VerifyingKey, signature::hazmat::PrehashVerifier};
use sev::certs::snp::{Certificate, Verifiable};
use sev::firmware::guest::AttestationReport;
use sha2::{Digest, Sha384};
use tracing::{debug, error, info};

pub(super) fn verify_signatures_locally(
    ask_cert: &Certificate,
    vek_cert: &Certificate,
    report: &AttestationReport,
    raw_report_bytes: &[u8],
) -> Result<()> {
    info!("Local Signature Verification");

    info!("Verifying ASK signature over VEK certificate...");
    match (ask_cert, vek_cert).verify() {
        Ok(_) => info!("PASS: ASK -> VEK signature verified."),
        Err(e) => {
            let err_msg = format!("ASK does not sign VEK: {e}");
            error!(details = %err_msg, "ASK -> VEK signature verification failed");
            return Err(anyhow!(err_msg));
        }
    }

    info!("Verifying VEK signature over Attestation Report body...");

    let vek_pubkey_sec1 = vek_cert.public_key_sec1();
    let encoded_point = p384::EncodedPoint::from_bytes(vek_pubkey_sec1)
        .map_err(|e| anyhow!("Failed to parse VEK public key SEC1 bytes: {e:?}"))
        .context("Parsing VEK public key point failed")?;
    let verifying_key = VerifyingKey::from_encoded_point(&encoded_point)
        .map_err(|e| anyhow!("Failed to create P-384 verifying key from point: {e:?}"))
        .context("Creating P-384 verifying key failed")?;
    debug!("Extracted and parsed VEK public key for report verification.");

    if raw_report_bytes.len() < SIGNED_DATA_LEN {
        let err_msg = format!(
            "Report bytes length ({}) is less than the expected signed data length ({} bytes).",
            raw_report_bytes.len(),
            SIGNED_DATA_LEN
        );
        error!(details = %err_msg, "Report length validation failed");
        return Err(anyhow!(err_msg));
    }
    let report_body_bytes = &raw_report_bytes[..SIGNED_DATA_LEN];
    debug!(
        len = report_body_bytes.len(),
        "Extracted report body for hashing."
    );

    let mut hasher = Sha384::new();
    hasher.update(report_body_bytes);
    let digest = hasher.finalize();
    let digest_hex = hex::encode(digest);
    info!(
        "Calculated SHA-384 digest of report body: {}",
        abbreviate_hex(&digest_hex, 8)
    );

    // Access fields via getter methods in sev 7.1.0
    let r_bytes = report.signature.r();
    let s_bytes = report.signature.s();

    if r_bytes.len() < P384_SCALAR_SIZE || s_bytes.len() < P384_SCALAR_SIZE {
        let err_msg = format!(
            "Report signature components (r/s) are shorter than the expected scalar size ({} bytes).",
            P384_SCALAR_SIZE
        );
        error!(details = %err_msg, "Signature component length validation failed");
        return Err(anyhow!(err_msg));
    }
    let sig_r_le = &r_bytes[..P384_SCALAR_SIZE];
    let sig_s_le = &s_bytes[..P384_SCALAR_SIZE];

    let mut sig_r_be_bytes = [0u8; P384_SCALAR_SIZE];
    sig_r_be_bytes.copy_from_slice(sig_r_le);
    sig_r_be_bytes.reverse();

    let mut sig_s_be_bytes = [0u8; P384_SCALAR_SIZE];
    sig_s_be_bytes.copy_from_slice(sig_s_le);
    sig_s_be_bytes.reverse();

    let signature = P384Signature::from_scalars(sig_r_be_bytes, sig_s_be_bytes)
        .map_err(|e| anyhow!("Failed to create p384 signature from r/s scalars: {e:?}"))
        .context("Constructing P384Signature object from report failed")?;
    debug!("Parsed and converted signature from report structure.");

    match verifying_key.verify_prehash(&digest, &signature) {
        Ok(_) => {
            info!("PASS: Report signature verified by VEK (Crypto check OK).");
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("Report signature verification FAILED: {e}");
            error!(details = %err_msg, "VEK -> Report signature verification failed");
            Err(anyhow!(
                "VEK does not sign the attestation report (signature mismatch): {}",
                e
            ))
        }
    }
}
