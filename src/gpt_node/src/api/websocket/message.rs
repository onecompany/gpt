use crate::api::websocket::types::ConversationRequest;
use crate::core::job::types::StreamedResponse;
use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use age::Decryptor;
use axum::extract::ws::{Message as WsMessage, WebSocket};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use futures::{SinkExt, StreamExt};
use rand::RngCore;
use std::net::SocketAddr;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

const MAX_CONSECUTIVE_LAG_ERRORS: usize = 3;
const GCM_NONCE_SIZE: usize = 12;

pub(super) async fn forward_stream_to_socket(
    socket: &mut WebSocket,
    receiver: &mut broadcast::Receiver<StreamedResponse>,
    stream_key: &str,
    chat_key: &[u8],
) {
    let last_message_was_final = Arc::new(AtomicBool::new(false));
    let mut lag_errors = 0;

    // Initialize cipher with the job-specific symmetric chat key
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(chat_key);
    let cipher = Aes256Gcm::new(key);

    loop {
        tokio::select! {
            biased;
            client_msg = socket.next() => {
                if handle_client_message(client_msg, socket, stream_key).await.is_err() {
                    info!("Client disconnected for stream. Breaking forward loop.");
                    break;
                }
            },
            broadcast_msg = receiver.recv() => {
                match handle_broadcast_message(broadcast_msg, socket, &last_message_was_final, stream_key, &cipher).await {
                    Ok(is_final) => {
                        lag_errors = 0;
                        if is_final {
                            info!("Final message sent for stream. Breaking forward loop.");
                            break;
                        }
                    },
                    Err(is_lag_error) => {
                        if is_lag_error {
                            lag_errors += 1;
                            warn!("Lag error #{} for stream. Terminating if threshold is met.", lag_errors);
                            if lag_errors >= MAX_CONSECUTIVE_LAG_ERRORS {
                                let lag_err = gpt_types::error::MessageErrorStatus::Unknown("Connection terminated due to excessive lag".to_string());
                                send_error_and_close(socket, Some(lag_err), &cipher).await;
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    }
}

pub(super) async fn try_receive_initial_request(
    socket: &mut WebSocket,
    addr: &SocketAddr,
    node_identity: &age::x25519::Identity,
) -> Result<ConversationRequest, ()> {
    match socket.next().await {
        Some(Ok(WsMessage::Text(base64_ciphertext))) => {
            debug!(client_addr=%addr, "Received encrypted initial handshake payload");

            // 1. Decode Base64
            // axum 0.8 `base64_ciphertext` is `Utf8Bytes`. Use .as_str() to satisfy AsRef<[u8]>
            let encrypted_bytes = match STANDARD.decode(base64_ciphertext.as_str()) {
                Ok(b) => b,
                Err(e) => {
                    error!(client_addr=%addr, error=%e, "Base64 decode failed for handshake");
                    return Err(());
                }
            };

            // 2. Decrypt with Age
            let decryptor = match Decryptor::new(&encrypted_bytes[..]) {
                Ok(d) => d,
                Err(e) => {
                    error!(client_addr=%addr, error=%e, "Failed to parse Age header");
                    return Err(());
                }
            };

            let mut decrypted_reader = match decryptor
                .decrypt(std::iter::once(node_identity as &dyn age::Identity))
            {
                Ok(r) => r,
                Err(e) => {
                    error!(client_addr=%addr, error=%e, "Age decryption failed (wrong identity?)");
                    return Err(());
                }
            };

            let mut json_bytes = Vec::new();
            if let Err(e) = std::io::Read::read_to_end(&mut decrypted_reader, &mut json_bytes) {
                error!(client_addr=%addr, error=%e, "Failed to read decrypted handshake bytes");
                return Err(());
            }

            // 3. Parse JSON
            match serde_json::from_slice::<ConversationRequest>(&json_bytes) {
                Ok(req) => Ok(req),
                Err(e) => {
                    error!(client_addr=%addr, error=%e, "Error parsing conversation request JSON");
                    // We can't send an encrypted error back yet because we don't have the chat key.
                    // Just close the socket.
                    let _ = socket.close().await;
                    Err(())
                }
            }
        }
        Some(Ok(other)) => {
            error!(client_addr=%addr, msg_type=?other, "Unexpected initial message type (expected Text/Base64)");
            let _ = socket.close().await;
            Err(())
        }
        Some(Err(e)) => {
            error!(client_addr=%addr, error=%e, "WebSocket receive error");
            Err(())
        }
        None => {
            info!(client_addr=%addr, "Connection closed before sending request.");
            Err(())
        }
    }
}

pub(super) async fn send_error_and_close(
    socket: &mut WebSocket,
    error_status: Option<gpt_types::error::MessageErrorStatus>,
    cipher: &Aes256Gcm,
) {
    let final_status = error_status.unwrap_or_else(|| {
        gpt_types::error::MessageErrorStatus::Unknown("An unexpected error occurred.".to_string())
    });

    let error_response = StreamedResponse {
        text: String::new(),
        is_complete: true,
        error_status: Some(final_status.clone()),
        usage: None,
    };
    warn!(
        ?error_response,
        "Sending structured error to client and closing connection."
    );

    if let Ok(json) = serde_json::to_string(&error_response)
        && let Ok(encrypted_b64) = encrypt_response(&json, cipher)
    {
        let _ = socket.send(WsMessage::Text(encrypted_b64.into())).await;
    }
    let _ = socket.close().await;
}

pub(super) async fn handle_client_message(
    msg_result: Option<Result<WsMessage, axum::Error>>,
    socket: &mut WebSocket,
    _stream_key: &str,
) -> Result<(), ()> {
    match msg_result {
        Some(Ok(WsMessage::Close(_))) => {
            info!("Close message received from client for stream key.");
            Err(())
        }
        Some(Ok(WsMessage::Ping(data))) => {
            debug!("Received Ping, sending Pong.");
            if socket.send(WsMessage::Pong(data)).await.is_err() {
                warn!("Failed to send Pong to client for stream key.");
                return Err(());
            }
            Ok(())
        }
        Some(Err(e)) => {
            warn!("WebSocket receive error from client: {}.", e);
            Err(())
        }
        None => {
            info!("Client socket closed for stream key.");
            Err(())
        }
        // We ignore other text/binary messages from client during streaming
        _ => Ok(()),
    }
}

async fn handle_broadcast_message(
    msg_result: Result<StreamedResponse, broadcast::error::RecvError>,
    socket: &mut WebSocket,
    last_message_was_final: &Arc<AtomicBool>,
    _stream_key: &str,
    cipher: &Aes256Gcm,
) -> Result<bool, bool> {
    match msg_result {
        Ok(update) => {
            let is_final = update.is_complete || update.error_status.is_some();
            last_message_was_final.store(is_final, Ordering::Relaxed);

            let json_update = serde_json::to_string(&update).unwrap();

            // Encrypt the JSON payload
            let encrypted_b64 = match encrypt_response(&json_update, cipher) {
                Ok(s) => s,
                Err(e) => {
                    error!("Encryption failed for stream chunk: {}", e);
                    return Err(false); // Terminate stream on crypto failure
                }
            };

            if socket
                .send(WsMessage::Text(encrypted_b64.into()))
                .await
                .is_err()
            {
                warn!("Failed to send update to client for stream key.");
                return Err(false);
            }
            Ok(is_final)
        }
        Err(broadcast::error::RecvError::Closed) => {
            info!("Broadcast channel closed for stream key.");
            if !last_message_was_final.load(Ordering::Relaxed) {
                warn!("Channel closed before a final message was sent.");
                let err_status = gpt_types::error::MessageErrorStatus::Unknown(
                    "Stream unexpectedly closed by server.".to_string(),
                );
                send_error_and_close(socket, Some(err_status), cipher).await;
            }
            Err(false)
        }
        Err(broadcast::error::RecvError::Lagged(n)) => {
            warn!("Receiver lagged by {} messages for stream key.", n);
            Err(true)
        }
    }
}

fn encrypt_response(json: &str, cipher: &Aes256Gcm) -> anyhow::Result<String> {
    let mut nonce_bytes = [0u8; GCM_NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, json.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption error: {}", e))?;

    // Combine IV + Ciphertext (Tag is already part of ciphertext in Rust aes-gcm crate)
    // Rust aes-gcm 'encrypt' returns vec with tag appended.
    let mut final_payload = Vec::with_capacity(GCM_NONCE_SIZE + ciphertext.len());
    final_payload.extend_from_slice(&nonce_bytes);
    final_payload.extend_from_slice(&ciphertext);

    Ok(STANDARD.encode(final_payload))
}
