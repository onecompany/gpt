use crate::clients::ai_provider::resilient_types::ProviderErrorBody;
use candid::Error as CandidError;
use gpt_types::error::{CanisterError, MessageErrorStatus, ProviderErrorType};
use ic_agent::AgentError;
use std::{error::Error, fmt};

#[derive(Debug)]
pub enum NodeError {
    Canister(CanisterError),
    Candid(CandidError),
    Agent(AgentError),
    Network(String),
    RateLimit(String),
    Timeout(String),
    Provider(OpenAIError),
    Configuration(String),
    Attestation(String),
    Other(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorSeverity {
    /// Temporary issues (rate limits, timeouts, server 5xx) where retrying might work
    /// or the node is still healthy for other jobs.
    Transient,
    /// The job failed due to input/logic, but the node itself is fine.
    JobFailure,
    /// Critical failure (invalid API key, zero balance, bad config) requiring operator intervention.
    /// The node should shut down.
    Terminal,
}

pub use async_openai::error::OpenAIError;

impl NodeError {
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            // Configuration or Attestation failures imply the node is misconfigured or untrusted.
            NodeError::Configuration(_) => ErrorSeverity::Terminal,
            NodeError::Attestation(_) => ErrorSeverity::Terminal,

            // Provider errors need deep inspection
            NodeError::Provider(e) => check_provider_severity(e),

            // Network/Timeout/RateLimit are typically transient or job-specific
            NodeError::Network(_) => ErrorSeverity::Transient,
            NodeError::Timeout(_) => ErrorSeverity::Transient,
            NodeError::RateLimit(_) => ErrorSeverity::Transient,

            // Canister/Agent errors might be terminal if Unauthorized (node kicked out),
            // but generally we treat them as job failures unless we wrap them specifically.
            // For now, Canister errors (like job not found) are just job failures.
            NodeError::Canister(e) => match e {
                CanisterError::Unauthorized => ErrorSeverity::Terminal, // Index rejected us?
                CanisterError::NodeNotFound => ErrorSeverity::Terminal, // We aren't registered?
                _ => ErrorSeverity::JobFailure,
            },
            NodeError::Agent(_) => ErrorSeverity::Transient, // Transport issues
            NodeError::Candid(_) => ErrorSeverity::JobFailure, // Bad data format
            NodeError::Other(_) => ErrorSeverity::JobFailure,
        }
    }
}

fn check_provider_severity(err: &OpenAIError) -> ErrorSeverity {
    match err {
        OpenAIError::ApiError(api_err) => {
            if let Some(code) = &api_err.code {
                // String or number in JSON, handled as string by async-openai/serde typically
                // but async_openai maps it to Option<String>.
                match code.as_str() {
                    "invalid_api_key"
                    | "insufficient_quota"
                    | "account_deactivated"
                    | "401"
                    | "402"
                    | "403" => return ErrorSeverity::Terminal,
                    _ => {}
                }
            }
            // Fallback: check message content if code is missing/generic
            let msg_lower = api_err.message.to_lowercase();
            if msg_lower.contains("insufficient quota")
                || msg_lower.contains("invalid api key")
                || msg_lower.contains("credit balance is too low")
            {
                return ErrorSeverity::Terminal;
            }
            ErrorSeverity::JobFailure
        }
        OpenAIError::Reqwest(e) => {
            if let Some(status) = e.status() {
                match status.as_u16() {
                    401..=403 => ErrorSeverity::Terminal,
                    _ => ErrorSeverity::Transient,
                }
            } else {
                ErrorSeverity::Transient // Network connect error, timeout, etc.
            }
        }
        // Stream errors are often network cuts or mid-stream fails
        OpenAIError::StreamError(_) => ErrorSeverity::Transient,
        // JSON errors are likely protocol mismatches, not fatal to the node's identity
        OpenAIError::JSONDeserialize(_, _) => ErrorSeverity::JobFailure,
        _ => ErrorSeverity::JobFailure,
    }
}

impl fmt::Display for NodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NodeError::Canister(e) => write!(f, "Canister error: {}", e),
            NodeError::Candid(e) => write!(f, "Candid error: {}", e),
            NodeError::Agent(e) => write!(f, "Agent error: {}", e),
            NodeError::Network(e) => write!(f, "Network error: {}", e),
            NodeError::RateLimit(e) => write!(f, "Rate limiting error: {}", e),
            NodeError::Timeout(e) => write!(f, "Timeout error: {}", e),
            NodeError::Provider(e) => write!(f, "Provider API error: {}", e),
            NodeError::Configuration(e) => write!(f, "Configuration error: {}", e),
            NodeError::Attestation(e) => write!(f, "Attestation error: {}", e),
            NodeError::Other(e) => write!(f, "Other node error: {}", e),
        }
    }
}

impl Error for NodeError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            NodeError::Canister(e) => Some(e),
            NodeError::Candid(e) => Some(e),
            NodeError::Agent(e) => Some(e),
            NodeError::Provider(e) => Some(e),
            _ => None,
        }
    }
}

impl From<CandidError> for NodeError {
    fn from(e: CandidError) -> Self {
        NodeError::Candid(e)
    }
}
impl From<CanisterError> for NodeError {
    fn from(e: CanisterError) -> Self {
        NodeError::Canister(e)
    }
}
impl From<OpenAIError> for NodeError {
    fn from(e: OpenAIError) -> Self {
        NodeError::Provider(e)
    }
}

impl From<AgentError> for NodeError {
    fn from(error: AgentError) -> Self {
        if let AgentError::HttpError(p) = &error {
            if p.status == 429 {
                return NodeError::RateLimit(format!("IC: {}", error));
            }
            if p.status >= 500 {
                return NodeError::Network(format!("IC: {}", error));
            }
        }
        if matches!(error, AgentError::TimeoutWaitingForResponse())
            || error.to_string().contains("timed out")
        {
            return NodeError::Timeout(format!("IC: {}", error));
        }
        NodeError::Agent(error)
    }
}

pub fn map_node_error_to_message_status(err: &NodeError) -> MessageErrorStatus {
    match err {
        NodeError::Provider(provider_err) => map_provider_error(provider_err),
        NodeError::Timeout(_) => MessageErrorStatus::ProviderError(ProviderErrorType::Timeout),
        NodeError::RateLimit(_) => {
            MessageErrorStatus::ProviderError(ProviderErrorType::RateLimited)
        }
        NodeError::Network(_) => MessageErrorStatus::ProviderError(ProviderErrorType::NetworkError),
        NodeError::Configuration(msg) => MessageErrorStatus::ConfigurationError(msg.clone()),
        NodeError::Attestation(msg) => {
            MessageErrorStatus::ConfigurationError(format!("Attestation failed: {}", msg))
        }
        NodeError::Agent(e) => MessageErrorStatus::CanisterCallError(format!("Agent error: {}", e)),
        NodeError::Canister(e) => {
            MessageErrorStatus::CanisterCallError(format!("Canister reported: {}", e))
        }
        NodeError::Candid(e) => {
            MessageErrorStatus::CanisterCallError(format!("Candid error: {}", e))
        }
        NodeError::Other(msg) => MessageErrorStatus::Unknown(msg.clone()),
    }
}

fn truncate_error_msg(msg: &str) -> String {
    const MAX_LEN: usize = 256;
    if msg.len() > MAX_LEN {
        format!("{}...", &msg[..MAX_LEN])
    } else {
        msg.to_string()
    }
}

fn map_provider_error(provider_err: &OpenAIError) -> MessageErrorStatus {
    match provider_err {
        OpenAIError::ApiError(api_err) => map_api_error(api_err),
        OpenAIError::StreamError(boxed_err) => map_stream_error(boxed_err),
        OpenAIError::Reqwest(rq_err) => map_reqwest_error(rq_err),
        OpenAIError::JSONDeserialize(e, content) => {
            // Attempt to recover meaningful error from the raw JSON content
            // if standard deserialization failed.
            if let Ok(provider_body) = serde_json::from_str::<ProviderErrorBody>(content) {
                let nice_message = match provider_body {
                    ProviderErrorBody::FastAPI { detail } => {
                        let msgs: Vec<String> = detail.iter().map(|d| d.msg.clone()).collect();
                        msgs.join("; ")
                    }
                    ProviderErrorBody::Simple { detail } => detail,
                    ProviderErrorBody::Standard { error } => error.message,
                };
                return ProviderErrorType::Unknown(truncate_error_msg(&nice_message)).into();
            }

            ProviderErrorType::Unknown(truncate_error_msg(&e.to_string())).into()
        }
        _ => ProviderErrorType::Unknown(truncate_error_msg(&provider_err.to_string())).into(),
    }
}

fn map_api_error(api_err: &async_openai::error::ApiError) -> MessageErrorStatus {
    if let Some(code) = &api_err.code {
        match code.as_str() {
            "context_length_exceeded" => return ProviderErrorType::ContextLengthExceeded.into(),
            "content_policy_violation" => return ProviderErrorType::ContentPolicyViolation.into(),
            "invalid_api_key" | "401" => return ProviderErrorType::AuthenticationError.into(),
            "rate_limit_exceeded" | "429" => return ProviderErrorType::RateLimited.into(),
            "503" => return ProviderErrorType::ServiceUnavailable.into(),
            "insufficient_quota" | "402" => {
                return ProviderErrorType::Unknown("Quota Exceeded".to_string()).into();
            }
            _ => {}
        }
    }
    if api_err.message.to_lowercase().contains("invalid image") {
        return ProviderErrorType::InvalidImage(truncate_error_msg(&api_err.message)).into();
    }
    let err_type = match api_err.code.as_deref() {
        Some("401") => ProviderErrorType::AuthenticationError,
        Some("402") | Some("insufficient_quota") => {
            ProviderErrorType::Unknown("Quota Exceeded".to_string())
        }
        Some("429") => ProviderErrorType::RateLimited,
        Some(c) if c.starts_with('5') => ProviderErrorType::ServerError,
        Some(_) => ProviderErrorType::BadRequest,
        None => ProviderErrorType::Unknown(truncate_error_msg(&api_err.message)),
    };
    err_type.into()
}

fn map_stream_error(s_err: &async_openai::error::StreamError) -> MessageErrorStatus {
    let err_string = s_err.to_string();
    let lower = err_string.to_lowercase();
    let err_type = if lower.contains("invalid image") {
        ProviderErrorType::InvalidImage(truncate_error_msg(&err_string))
    } else if lower.contains("401") || lower.contains("unauthorized") {
        ProviderErrorType::AuthenticationError
    } else if lower.contains("429") || lower.contains("rate limit") {
        ProviderErrorType::RateLimited
    } else if lower.contains("timeout") {
        ProviderErrorType::Timeout
    } else if lower.contains("insufficient quota") || lower.contains("402") {
        ProviderErrorType::Unknown("Quota Exceeded".to_string())
    } else {
        ProviderErrorType::NetworkError
    };
    err_type.into()
}

fn map_reqwest_error(rq_err: &reqwest::Error) -> MessageErrorStatus {
    let err_type = if rq_err.is_timeout() {
        ProviderErrorType::Timeout
    } else if rq_err.is_connect() || rq_err.is_request() || rq_err.is_body() {
        ProviderErrorType::NetworkError
    } else if rq_err.is_status() {
        match rq_err.status() {
            Some(sc) if sc.as_u16() == 401 => ProviderErrorType::AuthenticationError,
            Some(sc) if sc.as_u16() == 402 => {
                ProviderErrorType::Unknown("Quota Exceeded".to_string())
            }
            Some(sc) if sc.as_u16() == 429 => ProviderErrorType::RateLimited,
            Some(sc) if sc.as_u16() == 503 => ProviderErrorType::ServiceUnavailable,
            Some(sc) if sc.is_server_error() => ProviderErrorType::ServerError,
            Some(sc) if sc.is_client_error() => ProviderErrorType::BadRequest,
            _ => ProviderErrorType::Unknown(truncate_error_msg(&rq_err.to_string())),
        }
    } else {
        ProviderErrorType::Unknown(truncate_error_msg(&rq_err.to_string()))
    };
    err_type.into()
}
