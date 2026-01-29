//! Manual VM launch command (for debugging).

use anyhow::Result;
use std::path::PathBuf;
use crate::vm;

pub fn run_launch(
    port: u16,
    node_id: u64,
    seed_path_override: Option<&PathBuf>,
) -> Result<()> {
    vm::launcher::launch_node_vm(port, node_id, seed_path_override)
}
