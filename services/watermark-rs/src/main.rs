//! Watermark Service - High-performance image watermarking microservice
//!
//! Accepts image bytes and watermark text, returns watermarked image.
//! Designed to be called from the Node.js application.

use axum::{
    extract::Multipart,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use image::{ImageFormat, Rgba};
use imageproc::drawing::draw_text_mut;
use ab_glyph::{FontRef, PxScale};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use thiserror::Error;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

/// Default port for the service
const DEFAULT_PORT: u16 = 3847;

/// Default maximum upload size (1 GB)
const DEFAULT_MAX_UPLOAD_SIZE: usize = 1024 * 1024 * 1024;

/// Embedded font (Inter - open source, clean modern font)
const FONT_BYTES: &[u8] = include_bytes!("../assets/Inter.ttf");

#[derive(Error, Debug)]
enum WatermarkError {
    #[error("Missing required field: {0}")]
    MissingField(&'static str),

    #[error("Image processing error: {0}")]
    ImageError(#[from] image::ImageError),

    #[error("Invalid multipart data: {0}")]
    MultipartError(String),

    #[error("Font error: {0}")]
    FontError(String),

    #[error("Payload too large (max {0} bytes)")]
    PayloadTooLarge(usize),
}

impl IntoResponse for WatermarkError {
    fn into_response(self) -> Response {
        let status = match &self {
            WatermarkError::MissingField(_) => StatusCode::BAD_REQUEST,
            WatermarkError::MultipartError(_) => StatusCode::BAD_REQUEST,
            WatermarkError::ImageError(_) => StatusCode::UNPROCESSABLE_ENTITY,
            WatermarkError::FontError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            WatermarkError::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
        };

        let body = Json(ErrorResponse {
            error: self.to_string(),
        });

        (status, body).into_response()
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "lowercase")]
enum OutputFormat {
    #[default]
    Png,
    Jpeg,
    Webp,
}

impl OutputFormat {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "jpeg" | "jpg" => OutputFormat::Jpeg,
            "webp" => OutputFormat::Webp,
            _ => OutputFormat::Png,
        }
    }

    fn to_image_format(&self) -> ImageFormat {
        match self {
            OutputFormat::Png => ImageFormat::Png,
            OutputFormat::Jpeg => ImageFormat::Jpeg,
            OutputFormat::Webp => ImageFormat::WebP,
        }
    }

    fn content_type(&self) -> &'static str {
        match self {
            OutputFormat::Png => "image/png",
            OutputFormat::Jpeg => "image/jpeg",
            OutputFormat::Webp => "image/webp",
        }
    }
}

/// Health check endpoint
async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

/// Apply watermark to an image
///
/// Expects multipart form data with:
/// - `image`: The image bytes
/// - `text`: The watermark text
/// - `format`: Output format (optional, defaults to png)
async fn watermark(mut multipart: Multipart) -> Result<Response, WatermarkError> {
    let mut image_bytes: Option<Vec<u8>> = None;
    let mut watermark_text: Option<String> = None;
    let mut output_format = OutputFormat::Png;
    let max_upload_size = max_upload_size();

    // Parse multipart form
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| WatermarkError::MultipartError(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();

        match name.as_str() {
            "image" => {
                image_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| WatermarkError::MultipartError(e.to_string()))?
                        .to_vec(),
                );
            }
            "text" => {
                watermark_text = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| WatermarkError::MultipartError(e.to_string()))?,
                );
            }
            "format" => {
                let format_str = field
                    .text()
                    .await
                    .map_err(|e| WatermarkError::MultipartError(e.to_string()))?;
                output_format = OutputFormat::from_str(&format_str);
            }
            _ => {} // Ignore unknown fields
        }
    }

    let image_bytes = image_bytes.ok_or(WatermarkError::MissingField("image"))?;
    if image_bytes.len() > max_upload_size {
        return Err(WatermarkError::PayloadTooLarge(max_upload_size));
    }
    let watermark_text = watermark_text.ok_or(WatermarkError::MissingField("text"))?;

    // Process the image
    let result = apply_watermark(&image_bytes, &watermark_text, &output_format)?;

    // Return the watermarked image
    Ok((
        StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            output_format.content_type(),
        )],
        result,
    )
        .into_response())
}

/// Core watermarking logic
fn apply_watermark(
    image_bytes: &[u8],
    text: &str,
    output_format: &OutputFormat,
) -> Result<Vec<u8>, WatermarkError> {
    // Load the image
    let mut img = image::load_from_memory(image_bytes)?;
    let (width, height) = (img.width(), img.height());

    // Calculate font size based on image dimensions (similar to TypeScript version)
    let font_size = (width.min(height) as f32 / 30.0).max(14.0).min(48.0);
    let padding = font_size as i32;

    // Load font
    let font = FontRef::try_from_slice(FONT_BYTES)
        .map_err(|e| WatermarkError::FontError(e.to_string()))?;

    let scale = PxScale::from(font_size);

    // Build watermark text with timestamp
    let timestamp = chrono_lite_date();
    let full_text = format!("{} | {}", text, timestamp);

    // Calculate text position (bottom-left with padding)
    let x = padding;
    let y = height as i32 - padding;

    // Draw text shadow (dark, offset by 1px)
    let shadow_color = Rgba([0u8, 0u8, 0u8, 200u8]);
    draw_text_mut(
        &mut img,
        shadow_color,
        x + 1,
        y - font_size as i32 + 1,
        scale,
        &font,
        &full_text,
    );

    // Draw main text (semi-transparent white)
    let text_color = Rgba([255u8, 255u8, 255u8, 180u8]);
    draw_text_mut(
        &mut img,
        text_color,
        x,
        y - font_size as i32,
        scale,
        &font,
        &full_text,
    );

    // Encode to output format
    let mut output = Cursor::new(Vec::new());
    img.write_to(&mut output, output_format.to_image_format())?;

    Ok(output.into_inner())
}

/// Simple date formatting without pulling in chrono
fn chrono_lite_date() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    let secs = duration.as_secs();

    // Days since Unix epoch
    let days = secs / 86400;

    // Calculate year, month, day from days since epoch
    // Using a simplified algorithm
    let mut year = 1970;
    let mut remaining_days = days as i64;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let days_in_months: [i64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for &days_in_month in &days_in_months {
        if remaining_days < days_in_month {
            break;
        }
        remaining_days -= days_in_month;
        month += 1;
    }

    let day = remaining_days + 1;

    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn max_upload_size() -> usize {
    std::env::var("WATERMARK_MAX_UPLOAD_SIZE")
        .ok()
        .and_then(|value| parse_size_bytes(&value))
        .unwrap_or(DEFAULT_MAX_UPLOAD_SIZE)
}

fn parse_size_bytes(value: &str) -> Option<usize> {
    let normalized = value.trim().to_lowercase();
    let digit_count = normalized
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .count();
    if digit_count == 0 {
        return None;
    }

    let (number_part, unit_part) = normalized.split_at(digit_count);
    let number: u64 = number_part.parse().ok()?;
    let multiplier: u64 = match unit_part.trim() {
        "" | "b" => 1,
        "k" | "kb" => 1024,
        "m" | "mb" => 1024 * 1024,
        "g" | "gb" => 1024 * 1024 * 1024,
        _ => return None,
    };

    number
        .checked_mul(multiplier)
        .and_then(|bytes| usize::try_from(bytes).ok())
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    // Get port from environment or use default
    let port: u16 = std::env::var("WATERMARK_SERVICE_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    // Build router
    let max_upload_size = max_upload_size();
    let app = Router::new()
        .route("/health", get(health))
        .route("/watermark", post(watermark))
        .layer(axum::extract::DefaultBodyLimit::max(max_upload_size + 1024)) // image + form fields
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    info!("Watermark service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_date_format() {
        let date = chrono_lite_date();
        // Should be in YYYY-MM-DD format
        assert_eq!(date.len(), 10);
        assert_eq!(&date[4..5], "-");
        assert_eq!(&date[7..8], "-");
    }

    #[test]
    fn test_output_format_parsing() {
        assert!(matches!(OutputFormat::from_str("png"), OutputFormat::Png));
        assert!(matches!(OutputFormat::from_str("jpeg"), OutputFormat::Jpeg));
        assert!(matches!(OutputFormat::from_str("jpg"), OutputFormat::Jpeg));
        assert!(matches!(OutputFormat::from_str("webp"), OutputFormat::Webp));
        assert!(matches!(
            OutputFormat::from_str("unknown"),
            OutputFormat::Png
        ));
    }
}
