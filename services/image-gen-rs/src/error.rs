use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ImageGenError {
    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Image processing error: {0}")]
    ImageProcessing(String),

    #[error("Avatar fetch error: {0}")]
    AvatarFetch(String),

    #[error("Rendering error: {0}")]
    Rendering(String),
}

impl IntoResponse for ImageGenError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            ImageGenError::MissingField(_) | ImageGenError::InvalidInput(_) => {
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            ImageGenError::AvatarFetch(_) => {
                (StatusCode::UNPROCESSABLE_ENTITY, self.to_string())
            }
            ImageGenError::ImageProcessing(_) | ImageGenError::Rendering(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
        };

        let body = axum::Json(json!({ "error": message }));
        (status, body).into_response()
    }
}
