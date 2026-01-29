use crate::handlers::file_system::utils::get_or_create_root_folder_id;
use crate::storage::{bind_owner, get_config, get_parent_canister};
use gpt_types::{
    api::{
        ConfirmRegistrationRequest, ConfirmRegistrationResponse, ConfirmRegistrationResult,
        FinalizeRegistrationRequest, FinalizeRegistrationResponse, FinalizeRegistrationResult,
        GetUserAssignmentRequest, GetUserAssignmentResponse, GetUserAssignmentResult,
    },
    error::{CanisterError, CanisterResult},
};
use ic_cdk::call::Call;
use ic_cdk_macros::update;

const VERIFY_WITH_INDEX: bool = true;

#[update]
pub async fn finalize_registration(req: FinalizeRegistrationRequest) -> FinalizeRegistrationResult {
    finalize_registration_internal(req).await
}

async fn finalize_registration_internal(
    req: FinalizeRegistrationRequest,
) -> CanisterResult<FinalizeRegistrationResponse> {
    let caller = ic_cdk::api::msg_caller();
    ic_cdk::println!("finalize_registration called by: {}", caller);

    // Validation for Vault fields
    if req.enc_salt.len() < 16 {
        return Err(CanisterError::InvalidInput(
            "Salt must be at least 16 bytes.".to_string(),
        ));
    }
    if req.enc_validator.trim().is_empty() {
        return Err(CanisterError::InvalidInput(
            "Validator cannot be empty.".to_string(),
        ));
    }

    // Check if already bound to this user
    let config = get_config();
    if let Some(owner) = config.owner {
        if owner == caller {
            ic_cdk::println!("User {} is already bound to this canister.", caller);
            // Ensure root folder exists
            get_or_create_root_folder_id()?;
            return Ok(FinalizeRegistrationResponse { success: true });
        } else {
            ic_cdk::println!(
                "Canister already bound to different user {}. Rejecting {}.",
                owner,
                caller
            );
            return Err(CanisterError::Unauthorized);
        }
    }

    if VERIFY_WITH_INDEX {
        ic_cdk::println!("Verifying assignment and confirming active status with index...");
        let index_canister = get_parent_canister().ok_or_else(|| {
            ic_cdk::println!("ERROR: Parent canister ID not set in gpt_user.");
            CanisterError::Other("Configuration error: Parent canister not set".to_string())
        })?;

        // 1. Verify Assignment (Query) - Fast fail
        let assignment_req = GetUserAssignmentRequest {
            user_principal: caller,
        };
        let query_result = Call::unbounded_wait(index_canister, "get_user_assignment")
            .with_arg(&assignment_req)
            .await;

        match query_result {
            Ok(response) => {
                let assignment_enum: GetUserAssignmentResult = response
                    .candid()
                    .map_err(|e| CanisterError::CallError(format!("Decoding error: {}", e)))?;
                let assignment_res: CanisterResult<GetUserAssignmentResponse> =
                    assignment_enum.into();

                match assignment_res {
                    Ok(index_response) => {
                        if index_response.assigned_canister.len() != 1
                            || index_response.assigned_canister[0] != ic_cdk::api::canister_self()
                        {
                            ic_cdk::println!(
                                "Verification failed: User {} assigned to {:?}, not self.",
                                caller,
                                index_response.assigned_canister
                            );
                            return Err(CanisterError::Unauthorized);
                        }
                    }
                    Err(e) => return Err(e),
                }
            }
            Err(e) => return Err(CanisterError::CallError(format!("{:?}", e))),
        }

        // 2. Confirm Registration (Update) - Activates the slot
        let confirm_req = ConfirmRegistrationRequest {
            user_principal: caller,
        };
        let update_result = Call::unbounded_wait(index_canister, "confirm_registration")
            .with_arg(&confirm_req)
            .await;

        match update_result {
            Ok(response) => {
                let confirm_enum: ConfirmRegistrationResult = response
                    .candid()
                    .map_err(|e| CanisterError::CallError(format!("Decoding error: {}", e)))?;
                let confirm_res: CanisterResult<ConfirmRegistrationResponse> = confirm_enum.into();

                match confirm_res {
                    Ok(_) => {
                        ic_cdk::println!("Index confirmed activation for user {}.", caller);
                    }
                    Err(e) => return Err(e),
                }
            }
            Err(e) => return Err(CanisterError::CallError(format!("{:?}", e))),
        }
    } else {
        ic_cdk::println!("Skipping index verification (VERIFY_WITH_INDEX=false)");
    }

    // BIND THE CANISTER TO THIS USER
    if !bind_owner(caller, req.enc_salt, req.enc_validator) {
        ic_cdk::println!("Failed to bind owner - canister already bound to different user");
        return Err(CanisterError::Unauthorized);
    }
    ic_cdk::println!("Successfully bound canister to user {}.", caller);

    // Create root folder for the user
    get_or_create_root_folder_id()?;

    Ok(FinalizeRegistrationResponse { success: true })
}
