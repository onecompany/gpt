use crate::domain::common::ModelId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize, PartialEq, Eq)]
pub enum ModelStatus {
    Active,
    Paused,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Model {
    pub model_id: ModelId,
    pub name: String,
    pub description: String,
    pub max_context: u32,
    pub max_output: u32,
    pub input_token_price: f64,
    pub output_token_price: f64,
    pub maker: String,
    pub provider: String,
    pub provider_model: String,
    pub provider_endpoint: String,
    pub max_image_attachments: u32,
    pub max_tools: u32,
    pub aa_score: Option<u32>,
    pub release_date: Option<String>,
    pub status: ModelStatus,
    pub extra_body_json: Option<String>,
    pub is_reasoning: bool,
    pub is_embedding: bool,
    pub is_featured: bool,
}
