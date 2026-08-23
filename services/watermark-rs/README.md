# Watermark Service (Rust)

High-performance image watermarking microservice written in Rust. Used by the main Catto bot for applying watermarks to evidence images.

## Features

- Fast image watermarking using native Rust libraries
- Supports PNG, JPEG, and WebP formats
- Automatic timestamp appended to watermark text
- Health check endpoint for monitoring
- Graceful fallback (bot uses Sharp if this service is unavailable)

## API Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

### `POST /watermark`

Apply a watermark to an image.

**Request:** `multipart/form-data`
- `image` (required): The image file bytes
- `text` (required): The watermark text
- `format` (optional): Output format - `png`, `jpeg`, or `webp` (default: `png`)

**Response:** The watermarked image bytes with appropriate `Content-Type` header.

## Running Locally

### Prerequisites

- Rust 1.75+ (install via [rustup](https://rustup.rs/))

### Development

```bash
cd services/watermark-rs
cargo run
```

The service will start on `http://localhost:3847`.

### Production Build

```bash
cargo build --release
./target/release/watermark-service
```

## Docker

### Build

```bash
docker build -t catto-watermark ./services/watermark-rs
```

### Run

```bash
docker run -p 3847:3847 catto-watermark
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `WATERMARK_SERVICE_PORT` | `3847` | Port to listen on |
| `WATERMARK_MAX_UPLOAD_SIZE` | `1gb` | Max upload size (supports b/kb/mb/gb) |
| `RUST_LOG` | `info` | Log level (trace, debug, info, warn, error) |

## Integration

The main bot automatically detects if this service is available. If not, it falls back to Sharp-based watermarking.

Set `WATERMARK_SERVICE_URL` in the bot's environment to point to this service:

```bash
WATERMARK_SERVICE_URL=http://localhost:3847
```

When using Docker Compose, this is automatically configured.
