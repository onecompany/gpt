use anyhow::{Context, Result};
use sev::firmware::guest::{AttestationReport, Firmware};
use sev::parser::ByteParser;
use tracing::{debug, info};

pub(super) fn retrieve_attestation_report(
    report_data: [u8; 64],
) -> Result<(AttestationReport, Vec<u8>)> {
    info!("Retrieving attestation report from firmware...");

    let mut fw: Firmware = Firmware::open().context("Failed to open /dev/sev-guest device.")?;

    debug!("Using provided 64-byte report_data for replay protection.");

    let vmpl: Option<u32> = Some(1);

    let report_bytes: Vec<u8> = fw
        .get_report(None, Some(report_data), vmpl)
        .context("SEV firmware failed to generate the attestation report")?;

    info!(
        "Received report bytes from firmware ({} bytes).",
        report_bytes.len()
    );

    let report: AttestationReport = AttestationReport::from_bytes(&report_bytes)
        .context("Failed to parse raw bytes into AttestationReport structure")?;

    info!(
        "Parsed attestation report (Version: {}, Guest SVN: {}).",
        report.version, report.guest_svn
    );

    Ok((report, report_bytes))
}
