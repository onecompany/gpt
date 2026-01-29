use crate::storage::{
    CANISTER_POOL, CandidWrapper, CONFIG, MANAGERS, StorablePrincipal, TRIAL_EXPIRIES, USERS,
};
use gpt_types::{
    api::{
        common::CanisterPoolState, AddManagerRequest, AddManagerResponse, AddManagerResult,
        AddMeasurementRequest, AddMeasurementResponse, AddMeasurementResult,
        ClaimManagerRoleResponse, ClaimManagerRoleResult, IsManagerResponse, IsManagerResult,
        ListManagersResponse, ListManagersResult, RemoveManagerRequest, RemoveManagerResponse,
        RemoveManagerResult, RemoveMeasurementRequest, RemoveMeasurementResponse,
        RemoveMeasurementResult, UpdateAttestationPoliciesRequest,
        UpdateAttestationPoliciesResponse, UpdateAttestationPoliciesResult,
        UpdateMeasurementStatusRequest, UpdateMeasurementStatusResponse,
        UpdateMeasurementStatusResult,
    },
    domain::node::{AttestationMeasurement, AttestationRequirements, MeasurementStatus},
    error::{CanisterError, CanisterResult},
};
use hex;
use ic_cdk_macros::{query, update};

pub fn verify_manager() -> CanisterResult<()> {
    let caller = ic_cdk::api::msg_caller();
    let is_manager = MANAGERS.with(|m| m.borrow().contains_key(&StorablePrincipal(caller)));
    if !is_manager {
        Err(CanisterError::Unauthorized)
    } else {
        Ok(())
    }
}

#[query]
pub fn is_manager() -> IsManagerResult {
    let caller = ic_cdk::api::msg_caller();
    let is_manager = MANAGERS.with(|m| m.borrow().contains_key(&StorablePrincipal(caller)));
    Ok(IsManagerResponse { is_manager })
}

#[query]
pub fn list_managers() -> ListManagersResult {
    let managers = MANAGERS.with(|m| m.borrow().iter().map(|(k, _)| k.0).collect());
    Ok(ListManagersResponse { managers })
}

#[update]
pub fn claim_manager_role() -> ClaimManagerRoleResult {
    let is_claimed = MANAGERS.with(|m| !m.borrow().is_empty());
    if is_claimed {
        return Err(CanisterError::RoleAlreadyClaimed);
    }
    let caller = ic_cdk::api::msg_caller();
    MANAGERS.with(|m| m.borrow_mut().insert(StorablePrincipal(caller), ()));

    // If the user already has an assigned canister, upgrade it from trial to permanent
    if let Some(user_wrapper) = USERS.with(|u| u.borrow().get(&StorablePrincipal(caller))) {
        let canister_id = user_wrapper.0.user_canister_id;
        ic_cdk::println!(
            "Upgrading canister {} from trial to manager (permanent)",
            canister_id
        );

        // Update pool entry to remove expiry
        CANISTER_POOL.with(|pool| {
            let mut pool_map = pool.borrow_mut();
            if let Some(wrapper) = pool_map.get(&StorablePrincipal(canister_id)) {
                let mut entry = wrapper.0.clone();
                // Keep the owner but remove the expiry
                if let CanisterPoolState::Assigned { owner, .. } = entry.state {
                    entry.state = CanisterPoolState::Assigned {
                        owner,
                        expires_at: None, // Managers don't expire
                    };
                    pool_map.insert(StorablePrincipal(canister_id), CandidWrapper(entry));
                    ic_cdk::println!(
                        "Updated canister {} to manager state (no expiry)",
                        canister_id
                    );
                }
            }
        });

        // Remove from trial expiries
        TRIAL_EXPIRIES.with(|trials| {
            if trials.borrow_mut().remove(&canister_id).is_some() {
                ic_cdk::println!(
                    "Removed canister {} from trial expiries",
                    canister_id
                );
            }
        });
    }

    Ok(ClaimManagerRoleResponse)
}

#[update]
pub fn add_manager(req: AddManagerRequest) -> AddManagerResult {
    verify_manager()?;
    MANAGERS.with(|m| {
        m.borrow_mut()
            .insert(StorablePrincipal(req.principal_to_add), ())
    });
    Ok(AddManagerResponse)
}

#[update]
pub fn remove_manager(req: RemoveManagerRequest) -> RemoveManagerResult {
    verify_manager()?;
    let caller = ic_cdk::api::msg_caller();

    MANAGERS.with(|m| {
        let mut managers = m.borrow_mut();
        if managers.len() == 1
            && managers.contains_key(&StorablePrincipal(req.principal_to_remove))
            && caller == req.principal_to_remove
        {
            return Err(CanisterError::InvalidInput(
                "Cannot remove the last manager.".to_string(),
            ));
        }

        if managers
            .remove(&StorablePrincipal(req.principal_to_remove))
            .is_some()
        {
            Ok(RemoveManagerResponse)
        } else {
            Err(CanisterError::UserNotFound)
        }
    })
}

#[update]
pub fn add_measurement(req: AddMeasurementRequest) -> AddMeasurementResult {
    verify_manager()?;
    let hex_str = req.measurement_hex.trim().to_lowercase();

    if hex::decode(&hex_str).is_err() {
        return Err(CanisterError::InvalidInput(
            "Measurement must be a valid hex string.".to_string(),
        ));
    }

    CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();
        if let Some(reqs) = &mut wrapper.0.attestation_requirements {
            if reqs
                .measurements
                .iter()
                .any(|m| m.measurement_hex == hex_str)
            {
                return Err(CanisterError::InvalidInput(
                    "Measurement already exists.".to_string(),
                ));
            }

            reqs.measurements.push(AttestationMeasurement {
                measurement_hex: hex_str,
                name: req.name,
                status: MeasurementStatus::Active,
                created_at: ic_cdk::api::time(),
                updated_at: ic_cdk::api::time(),
            });
            c.borrow_mut().set(wrapper).expect("Failed to save config");
            Ok(AddMeasurementResponse)
        } else {
            Err(CanisterError::Other(
                "Requirements not initialized".to_string(),
            ))
        }
    })
}

#[update]
pub fn update_measurement_status(
    req: UpdateMeasurementStatusRequest,
) -> UpdateMeasurementStatusResult {
    verify_manager()?;
    let hex_str = req.measurement_hex.trim().to_lowercase();

    CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();
        if let Some(reqs) = &mut wrapper.0.attestation_requirements {
            if let Some(m) = reqs
                .measurements
                .iter_mut()
                .find(|m| m.measurement_hex == hex_str)
            {
                m.status = req.status;
                m.updated_at = ic_cdk::api::time();
                c.borrow_mut().set(wrapper).expect("Failed to save config");
                Ok(UpdateMeasurementStatusResponse)
            } else {
                Err(CanisterError::Other("Measurement not found.".to_string()))
            }
        } else {
            Err(CanisterError::Other(
                "Requirements not initialized".to_string(),
            ))
        }
    })
}

#[update]
pub fn remove_measurement(req: RemoveMeasurementRequest) -> RemoveMeasurementResult {
    verify_manager()?;
    let hex_str = req.measurement_hex.trim().to_lowercase();

    CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();
        if let Some(reqs) = &mut wrapper.0.attestation_requirements {
            let original_len = reqs.measurements.len();
            reqs.measurements.retain(|m| m.measurement_hex != hex_str);

            if reqs.measurements.len() == original_len {
                return Err(CanisterError::Other("Measurement not found.".to_string()));
            }

            c.borrow_mut().set(wrapper).expect("Failed to save config");
            Ok(RemoveMeasurementResponse)
        } else {
            Err(CanisterError::Other(
                "Requirements not initialized".to_string(),
            ))
        }
    })
}

#[update]
pub fn update_attestation_policies(
    req: UpdateAttestationPoliciesRequest,
) -> UpdateAttestationPoliciesResult {
    verify_manager()?;

    CONFIG.with(|c| {
        let mut wrapper = c.borrow().get().clone();

        // Preserve existing measurements if requirements exist
        let current_measurements = if let Some(existing) = &wrapper.0.attestation_requirements {
            existing.measurements.clone()
        } else {
            Vec::new()
        };

        let new_requirements = AttestationRequirements {
            min_report_version: req.min_report_version,
            milan_policy: req.milan_policy,
            genoa_policy: req.genoa_policy,
            turin_policy: req.turin_policy,
            require_smt_disabled: req.require_smt_disabled,
            require_tsme_disabled: req.require_tsme_disabled,
            require_ecc_enabled: req.require_ecc_enabled,
            require_rapl_disabled: req.require_rapl_disabled,
            require_ciphertext_hiding_enabled: req.require_ciphertext_hiding_enabled,
            expected_measurement_len: req.expected_measurement_len,
            max_attestation_age_ns: req.max_attestation_age_ns,
            measurements: current_measurements,
        };

        wrapper.0.attestation_requirements = Some(new_requirements);
        c.borrow_mut().set(wrapper).expect("Failed to save config");
        Ok(UpdateAttestationPoliciesResponse)
    })
}
