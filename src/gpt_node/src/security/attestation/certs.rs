use anyhow::{Result, anyhow};
use sev::certs::snp::{
    Certificate, Verifiable,
    builtin::{genoa, milan, turin},
    ca::Chain as CaChain,
};
use tracing::{info, warn};

pub struct VerifiedCaChain {
    pub chain: CaChain,
}

/// Tries to find a built-in CA chain that can verify the provided VEK (VCEK/VLEK).
pub fn verify_vek_against_builtins(vek: &Certificate) -> Result<VerifiedCaChain> {
    info!("Attempting to verify VEK against built-in CA chains...");

    // 1. Try Turin (Latest)
    if let (Ok(ark), Ok(ask)) = (turin::ark(), turin::ask()) {
        if (&ask, vek).verify().is_ok() {
            info!("VEK verified by Turin CA chain.");
            return Ok(VerifiedCaChain {
                chain: CaChain { ark, ask },
            });
        }
    } else {
        warn!("Could not load built-in Turin certs.");
    }

    // 2. Try Genoa
    if let (Ok(ark), Ok(ask)) = (genoa::ark(), genoa::ask()) {
        if (&ask, vek).verify().is_ok() {
            info!("VEK verified by Genoa CA chain.");
            return Ok(VerifiedCaChain {
                chain: CaChain { ark, ask },
            });
        }
    } else {
        warn!("Could not load built-in Genoa certs.");
    }

    // 3. Try Milan
    if let (Ok(ark), Ok(ask)) = (milan::ark(), milan::ask()) {
        if (&ask, vek).verify().is_ok() {
            info!("VEK verified by Milan CA chain.");
            return Ok(VerifiedCaChain {
                chain: CaChain { ark, ask },
            });
        }
    } else {
        warn!("Could not load built-in Milan certs.");
    }

    Err(anyhow!(
        "VEK could not be verified by any known built-in CA chain (Milan/Genoa/Turin)."
    ))
}
