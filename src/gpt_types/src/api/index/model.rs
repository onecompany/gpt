use crate::domain::model::Model;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetModelsRequest;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct GetModelsResponse {
    pub models: Vec<Model>,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddModelRequest {
    pub model: Model,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct AddModelResponse;

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateModelRequest {
    pub model: Model,
}

#[derive(CandidType, Deserialize, Debug, Serialize, Clone)]
pub struct UpdateModelResponse;
