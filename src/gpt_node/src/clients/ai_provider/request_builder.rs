use super::context::prepare_context;
use super::provider::Provider;
use crate::{
    clients::ai_provider::types::ExtendedChatCompletionRequest,
    core::error::NodeError,
    core::job::types::{OpenAIRequest, TokenizedMessage},
    core::state::AppState,
};
use async_openai::{
    error::OpenAIError,
    types::chat::{
        ChatCompletionMessageToolCall, ChatCompletionMessageToolCalls,
        ChatCompletionRequestAssistantMessageArgs, ChatCompletionRequestMessage,
        ChatCompletionRequestMessageContentPartImage,
        ChatCompletionRequestMessageContentPartImageArgs,
        ChatCompletionRequestMessageContentPartTextArgs, ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestToolMessageArgs, ChatCompletionRequestUserMessageArgs,
        ChatCompletionStreamOptions, ChatCompletionTool, ChatCompletionToolChoiceOption,
        ChatCompletionTools, CreateChatCompletionRequestArgs, FunctionCall, FunctionObjectArgs,
        ImageDetail, ImageUrlArgs, ReasoningEffort, ToolChoiceOptions,
    },
};
use base64::{Engine, engine::general_purpose::STANDARD};
use gpt_types::domain::Model;
use gpt_types::domain::message::ImageAttachment;
use serde_json::Value;
use std::collections::HashMap;
use tracing::{debug, info, warn};

pub(super) async fn build_request(
    request: &OpenAIRequest,
    state: &AppState,
    custom_prompt: Option<String>,
    _stream_key: &str,
    job_extra_json: Option<String>,
) -> Result<ExtendedChatCompletionRequest, NodeError> {
    info!(
        max_context_tokens = request.max_context,
        "Building provider request."
    );
    let model_details: Model = state.get_model_details().await.map_err(|e| {
        warn!(error = ?e, "Could not fetch model details from state.");
        NodeError::Configuration("Could not retrieve model details.".to_string())
    })?;
    let model_supports_images = model_details.max_image_attachments > 0;
    let is_reasoning_model = model_details.is_reasoning;

    // Detect provider from endpoint URL
    let provider = Provider::from_endpoint(&model_details.provider_endpoint);
    info!(
        provider = %provider.name(),
        endpoint = %model_details.provider_endpoint,
        "Detected AI provider."
    );

    // Get provider-specific configuration
    let provider_config = provider.get_request_config(
        is_reasoning_model,
        request.reasoning_effort.as_deref(),
        request.max_completion_tokens,
    );

    if !model_supports_images {
        info!(
            model_id = %state.model_id,
            "Target model is text-only. Image attachments will be ignored."
        );
    }

    let initial_token_count: u32 = request
        .messages
        .iter()
        .map(|m| {
            count_tokens(&m.content) + m.attachments.as_ref().map_or(0, |a: &Vec<_>| a.len() as u32 * 1000)
        })
        .sum();

    let tokenized_messages = prepare_context(&request.messages, request.max_context);
    let final_token_count: u32 = tokenized_messages.iter().map(|m| m.token_count).sum();

    if initial_token_count > final_token_count {
        info!(
            initial_tokens = initial_token_count,
            final_tokens = final_token_count,
            "Context truncated to fit token limit."
        );
    }

    let final_system_content = match custom_prompt {
        Some(prompt) if !prompt.trim().is_empty() => prompt.trim().to_string(),
        _ => {
            // For reasoning models, we might not want a default system prompt if it's not provided,
            // or the default behavior might differ. Here we keep the fallback.
            warn!("No custom_prompt found in Job. Using emergency fallback.");
            "You are a helpful AI assistant.".to_string()
        }
    };

    let mut all_messages = Vec::new();

    if !final_system_content.is_empty() {
        let system_msg = ChatCompletionRequestSystemMessageArgs::default()
            .content(final_system_content)
            .build()?;
        all_messages.push(ChatCompletionRequestMessage::System(system_msg));
    }

    for msg in tokenized_messages {
        let chat_msg = match msg.role.as_str() {
            "user" => Some(build_user_message(msg, model_supports_images)?),
            "assistant" => build_assistant_message(msg)?,
            "tool" => build_tool_message(msg)?,
            "system" => {
                let system_msg = ChatCompletionRequestSystemMessageArgs::default()
                    .content(msg.content)
                    .build()?;
                Some(ChatCompletionRequestMessage::System(system_msg))
            }
            _ => None,
        };
        if let Some(msg) = chat_msg {
            all_messages.push(msg);
        }
    }

    let mut openai_tools = Vec::new();
    if let Some(tools_from_candid) = &request.tools {
        for tool in tools_from_candid {
            debug!(tool_name = %tool.name, "Adding tool to request.");
            let params_json: serde_json::Value =
                serde_json::from_str(&tool.parameters).map_err(|e| {
                    NodeError::Configuration(format!(
                        "Invalid tool parameters JSON for tool '{}': {}",
                        tool.name, e
                    ))
                })?;

            let function_object = FunctionObjectArgs::default()
                .name(&tool.name)
                .description(tool.description.clone())
                .parameters(params_json)
                // Use strict mode if possible/desired, defaulted false or derived from tool config if expanded.
                // Assuming defaults for now.
                .build()?;

            let chat_completion_tool = ChatCompletionTool {
                function: function_object,
            };

            openai_tools.push(chat_completion_tool);
        }
    }

    let mut req_builder = CreateChatCompletionRequestArgs::default();
    req_builder
        .model(state.provider_model.clone())
        .messages(all_messages)
        .stream(true);

    // Provider-specific stream options (Mistral doesn't support stream_options)
    if provider_config.supports_stream_options {
        req_builder.stream_options(ChatCompletionStreamOptions {
            include_usage: Some(true),
            include_obfuscation: None,
        });
    }

    // Handle reasoning effort - only OpenAI uses the builder method directly
    // Mistral and Cerebras use extra_fields (handled by provider_config)
    if is_reasoning_model && provider == Provider::OpenAI {
        if let Some(effort_str) = &request.reasoning_effort {
            let effort_lower: String = effort_str.to_lowercase();
            let effort = match effort_lower.as_str() {
                "low" => ReasoningEffort::Low,
                "medium" => ReasoningEffort::Medium,
                "high" => ReasoningEffort::High,
                _ => ReasoningEffort::Medium, // Default
            };
            req_builder.reasoning_effort(effort);
        }
    }

    // Set token limit - only if NOT using max_tokens via extra_fields (Mistral)
    // For Mistral, max_tokens is added to extra_fields by provider_config
    if !provider_config.use_max_tokens {
        req_builder.max_completion_tokens(request.max_completion_tokens);
    }

    // Temperature for non-reasoning models (reasoning models typically don't support temperature)
    if !is_reasoning_model {
        req_builder.temperature(request.temperature);
    }

    if !openai_tools.is_empty() {
        let mut final_tools = Vec::new();
        let mut tool_names = Vec::new();

        for tool in openai_tools {
            tool_names.push(tool.function.name.clone());
            // async-openai 0.32.2 wraps tools in ChatCompletionTools enum
            final_tools.push(ChatCompletionTools::Function(tool));
        }

        info!(?tool_names, "Attached tools and set tool_choice to 'auto'.");
        req_builder
            .tools(final_tools)
            .tool_choice(ChatCompletionToolChoiceOption::Mode(
                ToolChoiceOptions::Auto,
            ));
    }

    let standard_req = req_builder.build()?;

    // Start with provider-specific fields (e.g., max_tokens for Mistral, reasoning_format for Cerebras)
    let mut extra_fields = provider_config.extra_fields;

    // Merge job-specific extra_body_json (user/model overrides take precedence)
    if let Some(json_str) = job_extra_json {
        match serde_json::from_str::<HashMap<String, Value>>(&json_str) {
            Ok(map) => extra_fields.extend(map),
            Err(e) => {
                warn!("Failed to parse extra_body_json from job: {}", e);
            }
        }
    }

    info!(
        model = %standard_req.model,
        provider = %provider.name(),
        messages_count = standard_req.messages.len(),
        tools_count = standard_req.tools.as_ref().map_or(0, |t| t.len()),
        max_completion_tokens = ?standard_req.max_completion_tokens,
        temperature = ?standard_req.temperature,
        stream_options = ?standard_req.stream_options,
        extra_fields_count = extra_fields.len(),
        extra_fields_keys = ?extra_fields.keys().collect::<Vec<_>>(),
        "Final provider request constructed."
    );
    debug!(
        model = %standard_req.model,
        messages_count = standard_req.messages.len(),
        "Provider request details."
    );

    Ok(ExtendedChatCompletionRequest {
        standard_request: standard_req,
        extra_fields,
    })
}

fn count_tokens(text: &str) -> u32 {
    ((text.chars().count() as f64) / 4.0).ceil() as u32
}

fn build_user_message(
    msg: TokenizedMessage,
    model_supports_images: bool,
) -> Result<ChatCompletionRequestMessage, NodeError> {
    let has_attachments = msg.attachments.as_deref().is_some_and(|a| !a.is_empty());
    if model_supports_images && has_attachments {
        let attachments = msg.attachments.unwrap();
        let mut content_parts = Vec::new();
        content_parts.push(
            ChatCompletionRequestMessageContentPartTextArgs::default()
                .text(msg.content)
                .build()?
                .into(),
        );
        for attachment in attachments {
            content_parts.push(build_image_part(attachment)?.into());
        }
        Ok(ChatCompletionRequestUserMessageArgs::default()
            .content(content_parts)
            .build()?
            .into())
    } else {
        Ok(ChatCompletionRequestUserMessageArgs::default()
            .content(msg.content)
            .build()?
            .into())
    }
}

fn build_assistant_message(
    msg: TokenizedMessage,
) -> Result<Option<ChatCompletionRequestMessage>, NodeError> {
    if let Some(tool_calls) = msg.tool_calls {
        let mut builder = ChatCompletionRequestAssistantMessageArgs::default();

        let api_tool_calls: Vec<ChatCompletionMessageToolCalls> = tool_calls
            .into_iter()
            .map(|tc| {
                // ChatCompletionMessageToolCall in 0.32.2 does not have `type` field
                let tool_call = ChatCompletionMessageToolCall {
                    id: tc.id,
                    function: FunctionCall {
                        name: tc.function.name,
                        arguments: tc.function.arguments,
                    },
                };
                ChatCompletionMessageToolCalls::Function(tool_call)
            })
            .collect();

        builder.tool_calls(api_tool_calls);

        if !msg.content.trim().is_empty() {
            builder.content(msg.content);
        }

        let assistant_message = builder.build()?;
        Ok(Some(assistant_message.into()))
    } else if !msg.content.trim().is_empty() {
        let assistant_message = ChatCompletionRequestAssistantMessageArgs::default()
            .content(msg.content)
            .build()?;
        Ok(Some(assistant_message.into()))
    } else {
        Ok(None)
    }
}

fn build_tool_message(
    msg: TokenizedMessage,
) -> Result<Option<ChatCompletionRequestMessage>, NodeError> {
    if let Some(tool_call_id) = msg.tool_call_id {
        let tool_message = ChatCompletionRequestToolMessageArgs::default()
            .content(msg.content)
            .tool_call_id(tool_call_id)
            .build()?;
        Ok(Some(tool_message.into()))
    } else {
        warn!("A 'tool' role message was found without a tool_call_id. Skipping.");
        Ok(None)
    }
}

fn build_image_part(
    attachment: ImageAttachment,
) -> Result<ChatCompletionRequestMessageContentPartImage, OpenAIError> {
    let b64 = STANDARD.encode(&attachment.data);
    let image_url = format!("data:{};base64,{}", attachment.mime_type, b64);
    let built_image_url = ImageUrlArgs::default()
        .url(image_url)
        .detail(ImageDetail::High)
        .build()?;
    ChatCompletionRequestMessageContentPartImageArgs::default()
        .image_url(built_image_url)
        .build()
}
