//! Node lifecycle commands (add, start, stop, remove, list, logs).

use anyhow::Result;
use crate::systemd;

pub fn add(node_id: u64, port: Option<u16>) -> Result<()> {
    systemd::service::add_service(node_id, port)
}

pub fn start(node_id: u64) -> Result<()> {
    systemd::service::start_service(node_id)
}

pub fn stop(node_id: u64) -> Result<()> {
    systemd::service::stop_service(node_id)
}

pub fn remove(node_id: u64) -> Result<()> {
    systemd::service::remove_service(node_id)
}

pub fn list() -> Result<()> {
    systemd::service::list_services()
}

pub fn logs(node_id: u64) -> Result<()> {
    systemd::service::follow_logs(node_id)
}
