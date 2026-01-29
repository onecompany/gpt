//! Host initialization command.

use anyhow::{Result, bail};
use colorful::Colorful;
use std::path::PathBuf;

use crate::identity;
use crate::systemd;

pub fn run_init(
    seed_path_override: Option<&PathBuf>,
    force: bool,
    identity_only: bool,
    router_only: bool,
) -> Result<()> {
    if !router_only {
        let seed_path = identity::get_seed_path(seed_path_override)?;

        if seed_path.exists() {
            if !force {
                if !identity_only {
                    println!(
                        "{}",
                        format!(
                            "Identity seed exists at {}. Skipping generation.",
                            seed_path.display()
                        )
                        .color(colorful::Color::Yellow)
                    );
                } else {
                    bail!(
                        "Identity seed already exists at {}. Use --force to overwrite.",
                        seed_path.display()
                    );
                }
            } else {
                println!(
                    "{}",
                    format!("Overwriting existing seed at {}", seed_path.display())
                        .color(colorful::Color::Yellow)
                );
                identity::generate_seed(&seed_path)?;
            }
        } else {
            identity::generate_seed(&seed_path)?;
        }
    }

    if !identity_only {
        println!("Setting up GPT Host Router Service...");
        systemd::service::setup_router_service()?;
    }

    Ok(())
}
