use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub parameters: String,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: FunctionCall,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub content: String,
    pub error: Option<String>,
}
