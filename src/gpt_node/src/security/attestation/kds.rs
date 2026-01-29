use super::requirements;
use anyhow::{Context, Result, anyhow};
use reqwest::blocking::Client;
use reqwest::{StatusCode, blocking::Response};
use sev::certs::snp::Certificate;
use sev::firmware::guest::AttestationReport;
use std::{
    thread::sleep,
    time::{Duration, Instant},
};
use tracing::{debug, info, warn};

fn detect_generation_candidates(report: &AttestationReport) -> Vec<&'static str> {
    if report.reported_tcb.fmc.is_some() {
        return vec!["Turin", "Genoa", "Milan"];
    }
    vec!["Genoa", "Milan", "Turin"]
}

pub(super) fn fetch_vek_certificate_retry(
    client: &Client,
    report: &AttestationReport,
) -> Result<(Certificate, Vec<u8>)> {
    let start_time = Instant::now();
    let mut attempt = 1;

    loop {
        match fetch_kds_vek_internal(client, report) {
            Ok(res) => return Ok(res),
            Err(e) => {
                if start_time.elapsed() >= requirements::KDS_TIMEOUT {
                    return Err(e.context("VEK fetch timed out"));
                }
                warn!("Attempt {} failed: {}. Retrying...", attempt, e);
                sleep(requirements::KDS_RETRY_DELAY);
                attempt += 1;
            }
        }
    }
}

fn fetch_kds_vek_internal(
    client: &Client,
    report: &AttestationReport,
) -> Result<(Certificate, Vec<u8>)> {
    let hw_id = hex::encode(report.chip_id);

    if report.chip_id.iter().all(|&b| b == 0) {
        return Err(anyhow!(
            "Chip ID in report is all zeros (MaskChipId=1). VLEK fetch without ChipID not fully implemented."
        ));
    }

    let generations = detect_generation_candidates(report);
    let cert_types = ["VCEK", "VLEK"];

    for generation in generations {
        for cert_type in cert_types {
            let url = build_kds_url(report, generation, cert_type, &hw_id);
            info!(
                "Trying to fetch {} for generation {}...",
                cert_type, generation
            );
            debug!("URL: {}", url);

            match client.get(&url).timeout(Duration::from_secs(10)).send() {
                Ok(response) => match handle_kds_response(response, cert_type) {
                    Ok(cert_data) => {
                        info!("Successfully fetched {} for {}", cert_type, generation);
                        return Ok(cert_data);
                    }
                    Err(FetchError::NotFound(msg)) => {
                        // This is expected if we are guessing the wrong generation
                        debug!(cert_type, message = %msg, "Certificate not found for generation {}, trying next...", generation);
                    }
                    Err(FetchError::Other(e)) => {
                        // This indicates a network error or server error, which is more serious
                        warn!(cert_type, error = %e, "Error during fetch from KDS for {}", url);
                    }
                },
                Err(e) => warn!("Network connection error fetching {}: {}", url, e),
            }
        }
    }

    Err(anyhow!(
        "Could not fetch valid VCEK or VLEK for any known generation."
    ))
}

fn build_kds_url(report: &AttestationReport, model: &str, cert_type: &str, hw_id: &str) -> String {
    let base = requirements::KDS_BASE_URL;
    let tcb = &report.reported_tcb;

    let endpoint = if cert_type == "VCEK" { "vcek" } else { "vlek" };

    let mut query = format!(
        "?blSPL={}&teeSPL={}&snpSPL={}&ucodeSPL={}",
        tcb.bootloader, tcb.tee, tcb.snp, tcb.microcode
    );

    if let Some(fmc) = tcb.fmc {
        query.push_str(&format!("&fmcSPL={}", fmc));
    }

    format!("{}/{}/v1/{}/{}{}", base, endpoint, model, hw_id, query)
}

enum FetchError {
    NotFound(String),
    Other(anyhow::Error),
}

fn handle_kds_response(
    response: Response,
    cert_type: &str,
) -> Result<(Certificate, Vec<u8>), FetchError> {
    let status = response.status();
    if status == StatusCode::OK {
        let bytes = response.bytes().map_err(|e| FetchError::Other(e.into()))?;
        let cert_bytes = bytes.to_vec();
        parse_certificate(&cert_bytes, cert_type).map_err(FetchError::Other)
    } else if status == StatusCode::NOT_FOUND {
        Err(FetchError::NotFound("HTTP 404 Not Found".to_string()))
    } else {
        let err_body = response
            .text()
            .unwrap_or_else(|_| "Failed to read body".into());
        Err(FetchError::Other(anyhow!("HTTP {} - {}", status, err_body)))
    }
}

fn parse_certificate(bytes: &[u8], cert_type: &str) -> Result<(Certificate, Vec<u8>)> {
    match Certificate::from_der(bytes) {
        Ok(cert) => {
            info!(
                "PASS: Successfully parsed {} cert (DER, {} bytes).",
                cert_type,
                bytes.len()
            );
            Ok((cert, bytes.to_vec()))
        }
        Err(e_der) => {
            warn!(
                cert_type,
                error = %e_der,
                "Failed to parse cert as DER, trying PEM..."
            );
            let cert = Certificate::from_pem(bytes)
                .context("Failed to parse cert as PEM after DER failure")?;
            warn!(
                "WARN: Fetched {} cert was PEM, parsed successfully.",
                cert_type
            );
            let der_bytes = cert
                .to_der()
                .context("Failed to convert parsed PEM cert back to DER")?;
            Ok((cert, der_bytes))
        }
    }
}
