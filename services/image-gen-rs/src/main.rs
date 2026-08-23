mod assets;
mod avatar;
mod cards;
mod color;
mod error;
mod text;

use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use text::SharedTextRenderer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, EnvFilter};

#[derive(Clone)]
struct AppState {
    text_renderer: SharedTextRenderer,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().with_env_filter(filter).init();

    // Create shared state
    let text_renderer = text::create_shared_renderer();
    let state = AppState { text_renderer };

    tracing::info!("Font system initialized with Anton + JetBrains Mono");

    // Build router
    let app = Router::new()
        .route("/health", get(health))
        .route("/bonk", post(handle_bonk))
        .route("/rank", post(handle_rank))
        .route("/leaderboard", post(handle_leaderboard))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Bind
    let port: u16 = std::env::var("IMAGE_GEN_SERVICE_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3848);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("Image generation service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await
        .expect("failed to bind TCP listener");
    axum::serve(listener, app).await
        .expect("server error");
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn handle_bonk(
    State(state): State<AppState>,
    payload: Result<Json<cards::bonk::BonkRequest>, JsonRejection>,
) -> Response {
    let req = match payload {
        Ok(Json(r)) => r,
        Err(e) => {
            let msg = format!("Invalid bonk request: {e}");
            tracing::error!("{msg}");
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": msg }))).into_response();
        }
    };
    match cards::bonk::render_bonk(&req, &state.text_renderer).await {
        Ok(png_data) => (StatusCode::OK, [("content-type", "image/png")], png_data).into_response(),
        Err(e) => {
            tracing::error!("Bonk render error: {e}");
            e.into_response()
        }
    }
}

async fn handle_rank(
    State(state): State<AppState>,
    payload: Result<Json<cards::rank::RankCardRequest>, JsonRejection>,
) -> Response {
    let req = match payload {
        Ok(Json(r)) => r,
        Err(e) => {
            let msg = format!("Invalid rank request: {e}");
            tracing::error!("{msg}");
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": msg }))).into_response();
        }
    };
    match cards::rank::render_rank_card(&req, &state.text_renderer).await {
        Ok(png_data) => (StatusCode::OK, [("content-type", "image/png")], png_data).into_response(),
        Err(e) => {
            tracing::error!("Rank card render error: {e}");
            e.into_response()
        }
    }
}

async fn handle_leaderboard(
    State(state): State<AppState>,
    payload: Result<Json<cards::leaderboard::LeaderboardRequest>, JsonRejection>,
) -> Response {
    let req = match payload {
        Ok(Json(r)) => r,
        Err(e) => {
            let msg = format!("Invalid leaderboard request: {e}");
            tracing::error!("{msg}");
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": msg }))).into_response();
        }
    };
    match cards::leaderboard::render_leaderboard(&req, &state.text_renderer).await {
        Ok(png_data) => (StatusCode::OK, [("content-type", "image/png")], png_data).into_response(),
        Err(e) => {
            tracing::error!("Leaderboard render error: {e}");
            e.into_response()
        }
    }
}
