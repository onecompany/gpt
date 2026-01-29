use crate::core::state::SharedState;
use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;

use super::{status, websocket};

/// Creates the HTTP router with all API endpoints.
pub fn create_router(state: SharedState) -> Router {
    Router::new()
        .route("/conversation/ws", get(websocket::ws_handler)) // Main WebSocket endpoint for jobs.
        .route("/status", get(status::status_handler)) // Health/status check endpoint.
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        .with_state(state)
}
