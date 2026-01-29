mod certs;
mod content;
mod kds;
mod report;
mod requirements;
mod util;
mod verification;

use anyhow::{Context, Result};
use gpt_types::domain::node::AttestationRequirements;
use reqwest::blocking::Client;
use std::time::Duration;
use tracing::info;

#[derive(Debug)]
pub struct AttestationData {
    pub report_bytes: Vec<u8>,
    pub ark_der: Vec<u8>,
    pub ask_der: Vec<u8>,
    pub vek_der: Vec<u8>,
}

pub fn fetch_attestation_data(
    requirements: &AttestationRequirements,
    report_data_payload: [u8; 64],
) -> Result<AttestationData> {
    info!("SEV-SNP Attestation Data Acquisition & Verification");

    // 1. Retrieve report with Replay Protection Payload
    let (parsed_report, report_bytes) = report::retrieve_attestation_report(report_data_payload)
        .context("Failed to retrieve attestation report")?;
    info!("Attestation report fetched ({} bytes).", report_bytes.len());

    // 2. Fetch VEK (VCEK/VLEK) using Smart KDS Logic
    info!("Fetching VEK certificate from AMD KDS...");
    let http_client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .context("Failed to build HTTP client for KDS")?;

    let (vek_cert, vek_der) = kds::fetch_vek_certificate_retry(&http_client, &parsed_report)
        .context("Failed to fetch VEK certificate from KDS")?;
    info!("VEK certificate fetched successfully.");

    // 3. Verify VEK against Built-in Roots (Milan/Genoa/Turin)
    let verified_chain = certs::verify_vek_against_builtins(&vek_cert)
        .context("Could not verify fetched VEK against any AMD Root CA")?;

    let ark_der = verified_chain
        .chain
        .ark
        .to_der()
        .context("Failed to serialize ARK")?;
    let ask_der = verified_chain
        .chain
        .ask
        .to_der()
        .context("Failed to serialize ASK")?;
    info!("Chain verified against internal root.");

    // 4. Local Signature Verification
    verification::verify_signatures_locally(
        &verified_chain.chain.ask,
        &vek_cert,
        &parsed_report,
        &report_bytes,
    )
    .context("Local signature verification (ASK->VEK or VEK->Report) failed")?;
    info!("PASS: Local signature verification successful.");

    // 5. Content Checks
    content::perform_report_content_checks(&parsed_report, requirements)
        .context("Attestation report content checks failed")?;
    info!("PASS: Attestation report content checks successful.");

    Ok(AttestationData {
        report_bytes,
        ark_der,
        ask_der,
        vek_der,
    })
}
