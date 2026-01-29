use super::connection::handle_socket_connection;
use crate::core::state::SharedState;
use axum::{
    extract::{ConnectInfo, State, ws::WebSocketUpgrade},
    response::IntoResponse,
};
use std::net::SocketAddr;
use tracing::info;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    info!(client_addr = %addr, "New WebSocket upgrade request");
    ws.on_upgrade(move |socket| handle_socket_connection(socket, addr, state))
}
