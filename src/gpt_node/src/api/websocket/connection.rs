use super::message::{forward_stream_to_socket, try_receive_initial_request};
use crate::{
    core::job::processor::handle_conversation_job, clients::ai_provider::BROADCAST_CHANNEL_CAPACITY,
    core::state::SharedState, core::job::types::StreamedResponse,
};
use axum::extract::ws::WebSocket;
use futures::SinkExt;
use std::net::SocketAddr;
use std::sync::atomic::Ordering;
use tokio::sync::broadcast;
use tracing::{Instrument, debug, error, info, info_span, warn};

pub async fn handle_socket_connection(mut socket: WebSocket, addr: SocketAddr, state: SharedState) {
    // GATEKEEPER: Check if node is in draining state
    if state.is_draining.load(Ordering::Relaxed) {
        warn!(client_addr = %addr, "Rejecting new WebSocket connection: Node is draining.");
        let _ = socket.close().await;
        return;
    }

    // Pass the node's private identity to the handshake function for decryption
    let request =
        match try_receive_initial_request(&mut socket, &addr, &state.node_x25519_identity).await {
            Ok(req) => req,
            Err(_) => {
                info!(
                    client_addr = %addr,
                    "Failed initial request or connection closed early. Terminating handler."
                );
                return;
            }
        };

    let stream_key = format!("{}:{}", request.user_canister_id, request.job_id);
    let span = info_span!(
        "ws_connection",
        client_addr = %addr,
        stream_key,
        job_id = request.job_id
    );

    async move {
        info!(
            user_canister = %request.user_canister_id,
            "Client initiated job via WebSocket"
        );

        let (mut receiver, should_spawn_job) = subscribe_to_job_stream(&state, &stream_key).await;

        let chat_key_result =
            handle_conversation_job(request.clone(), &state, stream_key.clone()).await;

        let chat_key = match chat_key_result {
            Ok(key) => key,
            Err(e) => {
                error!(
                    error = ?e,
                    "Error during initial job handling/claim. Notifying client."
                );
                // We can't encrypt the error because we failed to get the key.
                // We just close the socket.
                let _ = socket.close().await;
                // Cleanup
                if should_spawn_job {
                    state.job_streams.lock().await.remove(&stream_key);
                }
                return;
            }
        };

        forward_stream_to_socket(&mut socket, &mut receiver, &stream_key, &chat_key).await;

        if let Err(e) = socket.close().await {
            debug!(
                error = %e,
                "Error closing WebSocket (client might have disconnected already)."
            );
        }
        info!("WebSocket handler finished.");
    }
    .instrument(span)
    .await
}

async fn subscribe_to_job_stream(
    state: &SharedState,
    stream_key: &str,
) -> (broadcast::Receiver<StreamedResponse>, bool) {
    let mut job_streams_lock = state.job_streams.lock().await;
    if let Some(sender) = job_streams_lock.get(stream_key) {
        info!("Client subscribing to existing job stream.");
        (sender.subscribe(), false)
    } else {
        info!("No existing stream found. Creating new broadcast channel.");
        let (tx, rx) = broadcast::channel(BROADCAST_CHANNEL_CAPACITY);
        job_streams_lock.insert(stream_key.to_string(), tx);
        (rx, true)
    }
}
