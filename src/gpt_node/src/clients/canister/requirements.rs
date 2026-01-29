use crate::core::error::NodeError;
use crate::clients::canister::instrumented_canister_call;
use candid::{Decode, Encode};
use gpt_types::{
    api::{
        GetAttestationRequirementsRequest, GetAttestationRequirementsResponse,
        GetAttestationRequirementsResult,
    },
    domain::node::AttestationRequirements,
    error::CanisterResult,
};
use ic_agent::{Agent, export::Principal};
use tracing::{error, info};

pub async fn fetch_attestation_requirements(
    agent: &Agent,
    index_principal: &Principal,
) -> Result<AttestationRequirements, NodeError> {
    info!(
        "Fetching attestation requirements from index canister: {}",
        index_principal
    );

    let req_args = Encode!(&GetAttestationRequirementsRequest {})
        .map_err(|e| NodeError::Other(format!("Failed to encode request: {}", e)))?;

    let operation = || {
        agent
            .query(index_principal, "get_attestation_requirements")
            .with_arg(req_args.clone())
            .call()
    };

    let response_bytes = instrumented_canister_call(
        "fetch_attestation_requirements",
        false,
        index_principal,
        "get_attestation_requirements",
        operation,
        None,
    )
    .await?;

    let decoded_result: GetAttestationRequirementsResult =
        Decode!(&response_bytes, GetAttestationRequirementsResult).map_err(|e| {
            error!(
                "Failed to decode GetAttestationRequirementsResponse from {}: {}",
                index_principal, e
            );
            NodeError::Candid(e)
        })?;

    let result: CanisterResult<GetAttestationRequirementsResponse> = decoded_result.into();

    match result {
        Ok(resp) => {
            info!("Successfully decoded attestation requirements from index.");
            Ok(resp.requirements)
        }
        Err(canister_err) => {
            error!(
                "Index canister {} returned error while fetching attestation requirements: {:?}",
                index_principal, canister_err
            );
            Err(NodeError::Canister(canister_err))
        }
    }
}
