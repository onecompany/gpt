use crate::{core::error::NodeError, clients::canister::instrumented_canister_call};
use candid::{Decode, Encode};
use gpt_types::{
    api::{
        ClaimJobRequest, ClaimJobResponse, ClaimJobResult, CompleteJobRequest, CompleteJobResponse,
        CompleteJobResult, JobCompletionResult,
    },
    domain::message::TokenUsage,
    error::CanisterResult,
};
use ic_agent::{Agent, export::Principal};
use tracing::debug;

const MAX_RETRIES: u32 = 3;

pub async fn claim_job(
    agent: &Agent,
    job_id: u64,
    user_canister: Principal,
) -> Result<ClaimJobResponse, NodeError> {
    let request = ClaimJobRequest { job_id };
    debug!(
        job_id,
        user_canister = %user_canister,
        "Calling 'claim_job' on user canister"
    );
    let args = Encode!(&request)?;
    let operation = || {
        agent
            .update(&user_canister, "claim_job")
            .with_arg(args.clone())
            .call_and_wait()
    };

    let response_bytes = instrumented_canister_call(
        "claim_job",
        true,
        &user_canister,
        "claim_job",
        operation,
        Some(MAX_RETRIES),
    )
    .await?;

    let decoded_result: ClaimJobResult = Decode!(&response_bytes, ClaimJobResult)?;
    let decoded: CanisterResult<ClaimJobResponse> = decoded_result.into();

    if let Ok(ref response) = decoded {
        debug!(
            job_id = response.job.job_id,
            chat_id = response.chat.chat_id,
            "Successfully claimed job"
        );
    }

    decoded.map_err(NodeError::from)
}

pub async fn complete_job(
    agent: &Agent,
    job_id: u64,
    completion_result: JobCompletionResult,
    user_canister: Principal,
    usage: Option<TokenUsage>,
) -> Result<(), NodeError> {
    let request = CompleteJobRequest {
        job_id,
        result: completion_result,
        usage,
    };

    // Redact sensitive data from logging
    let result_summary = match &request.result {
        JobCompletionResult::Success(content) => format!("Success(len:{})", content.len()),
        JobCompletionResult::Failure(e) => format!("Failure({e:?})"),
        JobCompletionResult::ToolCall(calls) => format!("ToolCall(count:{})", calls.len()),
    };
    debug!(
        job_id,
        result = %result_summary,
        user_canister = %user_canister,
        "Calling 'complete_job' on user canister"
    );

    let args = Encode!(&request)?;
    let operation = || {
        agent
            .update(&user_canister, "complete_job")
            .with_arg(args.clone())
            .call_and_wait()
    };

    let response_bytes = instrumented_canister_call(
        "complete_job",
        true,
        &user_canister,
        "complete_job",
        operation,
        Some(MAX_RETRIES),
    )
    .await?;

    let decoded_result: CompleteJobResult = Decode!(&response_bytes, CompleteJobResult)?;
    let decoded: CanisterResult<CompleteJobResponse> = decoded_result.into();

    if decoded.is_ok() {
        debug!(job_id, "Successfully completed job");
    }

    decoded.map(|_| ()).map_err(NodeError::from)
}
