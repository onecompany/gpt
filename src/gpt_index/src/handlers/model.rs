use crate::handlers::governance::verify_manager;
use crate::storage::{CandidWrapper, MODELS};
use gpt_types::{
    api::{
        AddModelRequest, AddModelResponse, AddModelResult, GetModelsRequest, GetModelsResponse,
        UpdateModelRequest, UpdateModelResponse, UpdateModelResult,
    },
    domain::Model,
    error::{CanisterError, CanisterResult},
};
use ic_cdk_macros::{query, update};
use serde_json;

fn validate_extra_json(json_opt: &Option<String>) -> CanisterResult<()> {
    if let Some(json_str) = json_opt {
        if json_str.len() > 4096 {
            return Err(CanisterError::InvalidInput(
                "extra_body_json exceeds 4KB limit".to_string(),
            ));
        }
        if serde_json::from_str::<serde_json::Value>(json_str).is_err() {
            return Err(CanisterError::InvalidInput(
                "extra_body_json is not valid JSON".to_string(),
            ));
        }
    }
    Ok(())
}

#[query]
pub fn get_models(_req: GetModelsRequest) -> GetModelsResponse {
    ic_cdk::println!("get_models called");
    let models = MODELS.with(|models| {
        let cloned = models
            .borrow()
            .iter()
            .map(|(_, w)| w.0)
            .collect::<Vec<Model>>();
        ic_cdk::println!("Retrieved {} models", cloned.len());
        cloned
    });
    ic_cdk::println!("Returning get_models response");
    GetModelsResponse { models }
}

#[update]
pub fn add_model(req: AddModelRequest) -> AddModelResult {
    verify_manager()?;

    if req.model.model_id.trim().is_empty() {
        return Err(CanisterError::InvalidInput(
            "Model ID cannot be empty.".to_string(),
        ));
    }

    if req.model.model_id.len() > 64 {
        return Err(CanisterError::InvalidInput(
            "Model ID exceeds maximum length of 64 characters.".to_string(),
        ));
    }

    validate_extra_json(&req.model.extra_body_json)?;

    MODELS.with(|models| {
        let mut m = models.borrow_mut();
        if m.contains_key(&req.model.model_id) {
            return Err(CanisterError::InvalidInput(format!(
                "Model {} already exists.",
                req.model.model_id
            )));
        }
        m.insert(req.model.model_id.clone(), CandidWrapper(req.model));
        Ok(AddModelResponse)
    })
}

#[update]
pub fn update_model(req: UpdateModelRequest) -> UpdateModelResult {
    verify_manager()?;

    if req.model.model_id.trim().is_empty() {
        return Err(CanisterError::InvalidInput(
            "Model ID cannot be empty.".to_string(),
        ));
    }

    if req.model.model_id.len() > 64 {
        return Err(CanisterError::InvalidInput(
            "Model ID exceeds maximum length of 64 characters.".to_string(),
        ));
    }

    validate_extra_json(&req.model.extra_body_json)?;

    MODELS.with(|models| {
        let mut m = models.borrow_mut();
        if !m.contains_key(&req.model.model_id) {
            return Err(CanisterError::ModelNotFound);
        }
        m.insert(req.model.model_id.clone(), CandidWrapper(req.model));
        Ok(UpdateModelResponse)
    })
}
