use crate::{
    Args,
    security::attestation::AttestationData,
    core::error::NodeError,
    clients::canister::{
        requirements::fetch_attestation_requirements,
        whoami::perform_raw_whoami_with_agent,
        client::build_ic_agent,
    },
};
use candid::{Decode, Encode};
use gpt_types::{
    api::{
        GetModelsRequest, GetModelsResponse, GetNodeConfigRequest, GetNodeConfigResponse,
        GetNodeConfigResult, RegisterNodeRequest, RegisterNodeResponse, RegisterNodeResult,
    },
    domain::node::AttestationRequirements,
    prelude::{CanisterResult, Model, NodeId},
};
use ic_agent::{Agent, AgentError, export::Principal};
use k256::ecdsa::SigningKey;
use tracing::{error, info, warn};

use crate::clients::canister::instrumented_canister_call;

pub(super) async fn fetch_setup_requirements(
    args: &Args,
    ephemeral_signing_key: &SigningKey,
) -> Result<(Principal, AttestationRequirements), NodeError> {
    info!("Fetching attestation requirements from index canister...");
    let temp_agent =
        build_ic_agent(&args.network_type, &args.replica_url, ephemeral_signing_key).await?;
    let index_principal = Principal::from_text(&args.canister_principal).map_err(|_| {
        NodeError::Configuration(format!(
            "Invalid index canister principal: '{}'",
            args.canister_principal
        ))
    })?;
    let requirements = fetch_attestation_requirements(&temp_agent, &index_principal).await?;

    if requirements.measurements.is_empty() {
        return Err(NodeError::Configuration(
            "The index canister's attestation measurements have not been configured by a manager. Please ensure setup is complete before starting the node.".to_string(),
        ));
    }

    info!("Successfully fetched attestation requirements.");
    Ok((index_principal, requirements))
}

pub(super) async fn register_and_configure_node(
    args: &Args,
    index_principal: &Principal,
    ephemeral_signing_key: &SigningKey,
    node_id: NodeId,
    attestation_data: AttestationData,
    timestamp: u64,
    node_public_key: String,
) -> Result<(Agent, GetNodeConfigResponse, Model), NodeError> {
    info!("Setting up main IC Agent...");
    let agent =
        build_ic_agent(&args.network_type, &args.replica_url, ephemeral_signing_key).await?;
    info!("Main IC Agent created successfully.");

    info!("Registering node {}...", node_id);
    register_node_with_attestation(
        &agent,
        index_principal,
        node_id,
        attestation_data,
        timestamp,
        node_public_key,
    )
    .await?;
    info!("Node {} successfully registered and activated.", node_id);

    info!("Fetching configuration for node_id: {}", node_id);
    let node_config = fetch_node_config(&agent, index_principal, node_id).await?;
    info!(
        hostname = %node_config.hostname,
        model_id = %node_config.model_id,
        "Node configuration fetched successfully"
    );

    if let Err(e) = perform_raw_whoami_with_agent(&agent, &args.canister_principal).await {
        warn!(error = %e, "Optional raw_whoami call failed");
    }

    info!("Fetching Model Details for '{}'...", node_config.model_id);
    let model_details = fetch_model_details(&agent, index_principal, &node_config.model_id).await?;
    info!(
        provider = %model_details.provider,
        provider_model = %model_details.provider_model,
        "Found model details"
    );

    Ok((agent, node_config, model_details))
}

async fn register_node_with_attestation(
    agent: &Agent,
    index_principal: &Principal,
    node_id: NodeId,
    attestation_data: AttestationData,
    timestamp: u64,
    node_public_key: String,
) -> Result<(), NodeError> {
    let register_req = RegisterNodeRequest {
        node_id,
        attestation_report: attestation_data.report_bytes,
        ark_der: attestation_data.ark_der,
        ask_der: attestation_data.ask_der,
        vek_der: attestation_data.vek_der,
        timestamp,
        public_key: node_public_key,
    };
    let register_args = Encode!(&register_req).map_err(NodeError::Candid)?;

    let operation = || {
        agent
            .update(index_principal, "register_node")
            .with_arg(register_args.clone())
            .call_and_wait()
    };

    let response_bytes = instrumented_canister_call(
        "register_node",
        true,
        index_principal,
        "register_node",
        operation,
        None,
    )
    .await
    .inspect_err(|e| {
        if let NodeError::Agent(AgentError::HttpError(payload)) = e {
            error!(
                status = payload.status,
                body = %String::from_utf8_lossy(&payload.content),
                "Agent HTTP Error during register_node"
            );
        }
    })?;

    let decoded_result: RegisterNodeResult =
        Decode!(&response_bytes, RegisterNodeResult).map_err(NodeError::Candid)?;
    let decoded: CanisterResult<RegisterNodeResponse> = decoded_result.into();

    match decoded {
        Ok(resp) if resp.success => Ok(()),
        Ok(_) => Err(NodeError::Other(format!(
            "Registration rejected by index for node_id {node_id}"
        ))),
        Err(e) => Err(NodeError::Canister(e)),
    }
}

async fn fetch_node_config(
    agent: &Agent,
    index_principal: &Principal,
    node_id: NodeId,
) -> Result<GetNodeConfigResponse, NodeError> {
    let config_req = GetNodeConfigRequest { node_id };
    let config_args = Encode!(&config_req).map_err(NodeError::Candid)?;

    let operation = || {
        agent
            .query(index_principal, "get_node_config")
            .with_arg(config_args.clone())
            .call()
    };

    let response_bytes = instrumented_canister_call(
        "fetch_node_config",
        false,
        index_principal,
        "get_node_config",
        operation,
        None,
    )
    .await?;

    let decoded_result: GetNodeConfigResult =
        Decode!(&response_bytes, GetNodeConfigResult).map_err(NodeError::Candid)?;
    let decoded: CanisterResult<GetNodeConfigResponse> = decoded_result.into();

    decoded.map_err(NodeError::Canister)
}

async fn fetch_model_details(
    agent: &Agent,
    index_principal: &Principal,
    model_id: &str,
) -> Result<Model, NodeError> {
    let req_bytes = Encode!(&GetModelsRequest {}).map_err(NodeError::Candid)?;

    let operation = || {
        agent
            .query(index_principal, "get_models")
            .with_arg(req_bytes.clone())
            .call()
    };

    let res_bytes = instrumented_canister_call(
        "fetch_model_details",
        false,
        index_principal,
        "get_models",
        operation,
        None,
    )
    .await?;

    // GetModelsResponse is direct, not wrapped in CanisterResult
    let response: GetModelsResponse =
        Decode!(&res_bytes, GetModelsResponse).map_err(NodeError::Candid)?;

    response
        .models
        .into_iter()
        .find(|m| m.model_id == model_id)
        .ok_or_else(|| {
            NodeError::Configuration(format!("Model ID '{model_id}' not found in index list"))
        })
}
