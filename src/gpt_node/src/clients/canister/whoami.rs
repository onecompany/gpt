use candid::{Decode, Encode};
use gpt_types::api::{RawWhoAmIRequest, RawWhoAmIResponse};
use ic_agent::{Agent, export::Principal};
use tracing::info;

pub async fn perform_raw_whoami_with_agent(
    agent: &Agent,
    index_canister_str: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let index_principal = Principal::from_text(index_canister_str).map_err(|e| {
        format!(
            "Invalid canister principal ID '{}': {}",
            index_canister_str, e
        )
    })?;

    let whoami_args = RawWhoAmIRequest {};

    let encoded = Encode!(&whoami_args)?;

    let result_bytes = agent
        .query(&index_principal, "raw_whoami")
        .with_arg(encoded)
        .call()
        .await?;

    let decoded: RawWhoAmIResponse = Decode!(&result_bytes, RawWhoAmIResponse)?;
    info!("raw_whoami: principal={}", decoded.principal.to_text());

    Ok(())
}
