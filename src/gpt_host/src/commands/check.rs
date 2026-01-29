//! System diagnostics command.

use anyhow::Result;
use crate::diagnostics::{checks, display, telemetry};

pub fn run_check() -> Result<()> {
    // Gather all system telemetry
    let telemetry = telemetry::gather_host_telemetry()?;

    // Evaluate rules against telemetry
    let results = checks::evaluate_system(&telemetry);

    // Render the dashboard
    display::render_dashboard(&telemetry, &results);

    Ok(())
}
