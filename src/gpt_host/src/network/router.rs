use crate::systemd::watcher::{WatcherConfig, run_watcher};
use anyhow::Result;
use axum::{
    Router,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, Uri},
    response::Response,
};
use futures::StreamExt; // Required for .map() on streams
use hyper_util::rt::TokioIo;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, error, info};

/// Shared routing table: Hostname -> Local Port
pub type RoutingTable = Arc<RwLock<HashMap<String, u16>>>;

#[derive(Clone)]
struct AppState {
    table: RoutingTable,
    http_client: reqwest::Client,
}

pub async fn start_router(port: u16, ic_url: String, canister_id: String) -> Result<()> {
    let table = Arc::new(RwLock::new(HashMap::new()));
    let (tx, rx) = mpsc::channel(1); // Signal channel for SIGHUP watcher trigger

    // Spawn Signal Handler for SIGHUP
    tokio::spawn(async move {
        let mut sighup =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::hangup()).unwrap();
        loop {
            sighup.recv().await;
            info!("Received SIGHUP. Triggering watcher refresh.");
            let _ = tx.send(()).await;
        }
    });

    // Spawn Watcher
    let watcher_table = table.clone();
    tokio::spawn(async move {
        run_watcher(
            watcher_table,
            WatcherConfig {
                ic_url,
                canister_id,
            },
            rx,
        )
        .await;
    });

    // Setup Axum
    let state = AppState {
        table,
        http_client: reqwest::Client::builder()
            .no_gzip()
            .no_brotli()
            .no_deflate()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap(),
    };

    // Use fallback for catch-all proxying instead of a specific route path.
    // This avoids matchit parsing issues and correctly handles all paths including root.
    let app = Router::new().fallback(proxy_handler).with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("GPT Host Router listening on {}", addr);

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn proxy_handler(
    State(state): State<AppState>,
    mut req: Request<Body>,
) -> Result<Response, StatusCode> {
    let host = req
        .headers()
        .get("host")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::BAD_REQUEST)?
        .split(':')
        .next()
        .unwrap_or(""); // Strip port if present

    let target_port = {
        let r = state.table.read().await;
        r.get(host).copied()
    };

    let port = match target_port {
        Some(p) => p,
        None => {
            debug!("No route found for host: {}", host);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    // Construct URI
    let path = req.uri().path();
    let query = req
        .uri()
        .query()
        .map(|q| format!("?{}", q))
        .unwrap_or_default();
    let uri_string = format!("http://127.0.0.1:{}{}{}", port, path, query);
    let uri = uri_string
        .parse::<Uri>()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    *req.uri_mut() = uri;

    // WebSocket Upgrade Check
    if let Some(upgrade) = req.headers().get("upgrade")
        && upgrade
            .to_str()
            .unwrap_or("")
            .eq_ignore_ascii_case("websocket")
    {
        return handle_websocket_proxy(req, state.http_client, uri_string).await;
    }

    // Standard HTTP Proxy using Reqwest
    let client = state.http_client;
    let method = req.method().clone();
    let uri_req = req.uri().clone();
    let headers = req.headers().clone();
    let body = req.into_body();

    // Map Axum body errors to std::io::Error for Reqwest
    // Use http_body_util::BodyExt::into_data_stream to get a Stream
    // .map() comes from futures::StreamExt
    let body_stream = body
        .into_data_stream()
        .map(|res| res.map_err(std::io::Error::other));
    let reqwest_body = reqwest::Body::wrap_stream(body_stream);

    let req_builder = client
        .request(method, uri_req.to_string())
        .headers(headers)
        .body(reqwest_body);

    match req_builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            let headers = resp.headers().clone();
            let body_stream = resp.bytes_stream();
            let axum_body = Body::from_stream(body_stream);

            let mut response_builder = Response::builder().status(status);
            *response_builder.headers_mut().unwrap() = headers;
            response_builder
                .body(axum_body)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        }
        Err(e) => {
            error!("Proxy request failed to {}: {}", uri_req, e);
            Err(StatusCode::BAD_GATEWAY)
        }
    }
}

async fn handle_websocket_proxy(
    mut req: Request<Body>,
    client: reqwest::Client,
    uri: String,
) -> Result<Response, StatusCode> {
    // 1. Prepare Request Headers for Backend Handshake
    let sec_websocket_key = req.headers().get("sec-websocket-key").cloned();
    let sec_websocket_version = req.headers().get("sec-websocket-version").cloned();
    let sec_websocket_protocol = req.headers().get("sec-websocket-protocol").cloned();

    // 2. Initiate handshake with the Backend (gpt_node) via Reqwest
    let mut backend_req_builder = client
        .request(req.method().clone(), uri)
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket");

    if let Some(val) = sec_websocket_key {
        backend_req_builder = backend_req_builder.header("Sec-WebSocket-Key", val);
    }
    if let Some(val) = sec_websocket_version {
        backend_req_builder = backend_req_builder.header("Sec-WebSocket-Version", val);
    }
    if let Some(val) = sec_websocket_protocol {
        backend_req_builder = backend_req_builder.header("Sec-WebSocket-Protocol", val);
    }

    let backend_resp = backend_req_builder.send().await.map_err(|e| {
        error!("Failed to connect to backend for WebSocket upgrade: {}", e);
        StatusCode::BAD_GATEWAY
    })?;

    if backend_resp.status() != StatusCode::SWITCHING_PROTOCOLS {
        error!(
            "Backend refused WebSocket upgrade: Status {}",
            backend_resp.status()
        );
        return Err(backend_resp.status());
    }

    // 3. Prepare Client Upgrade
    // hyper::upgrade::on consumes the request body management.
    let client_upgrade_fut = hyper::upgrade::on(&mut req);

    // 4. Construct Response for Client
    // We mirror the backend's response headers to ensure Sec-WebSocket-Accept matches.
    let mut response_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);
    if let Some(h_map) = response_builder.headers_mut() {
        for (k, v) in backend_resp.headers() {
            h_map.insert(k, v.clone());
        }
    }
    let response = response_builder
        .body(Body::empty())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Spawn Bridge Task
    tokio::spawn(async move {
        // Await client upgrade (resolves after we return the 101 response below)
        let client_io_result = client_upgrade_fut.await;
        // Await backend upgrade
        let backend_io_result = backend_resp.upgrade().await;

        match (client_io_result, backend_io_result) {
            (Ok(client_upgraded), Ok(backend_upgraded)) => {
                // `client_upgraded` implements hyper::rt::Read/Write (Hyper IO)
                // `backend_upgraded` implements tokio::io::AsyncRead/Write (Tokio IO)

                // Wrap Hyper IO in TokioIo to make it Tokio-compatible
                let mut client_io = TokioIo::new(client_upgraded);
                let mut backend_io = backend_upgraded;

                if let Err(e) = tokio::io::copy_bidirectional(&mut client_io, &mut backend_io).await
                {
                    debug!("WebSocket bridge closed with error: {}", e);
                }
            }
            (Err(e), _) => error!("Client upgrade failed: {}", e),
            (_, Err(e)) => error!("Backend upgrade failed: {}", e),
        }
    });

    Ok(response)
}
