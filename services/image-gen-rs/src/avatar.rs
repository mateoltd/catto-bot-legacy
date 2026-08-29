use crate::error::ImageGenError;
use image::GenericImageView;
use std::sync::OnceLock;
use tiny_skia::{
    FillRule, FilterQuality, Mask, Paint, PathBuilder, Pixmap, PixmapPaint, Transform,
};

/// Maximum avatar response body size (10 MB).
const MAX_AVATAR_BYTES: usize = 10 * 1024 * 1024;

fn avatar_paint() -> PixmapPaint {
    PixmapPaint {
        quality: FilterQuality::Bicubic,
        ..PixmapPaint::default()
    }
}

/// Shared HTTP client — created once, reused for all avatar fetches.
fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("failed to build reqwest client")
    })
}

/// Normalise a Discord CDN avatar URL so it always requests a static PNG.
/// Animated avatars are served as `.gif` by default, which we cannot embed
/// into a static card image. Discord's CDN happily serves a `.png` for any
/// avatar hash, so we just swap the extension.
fn normalise_avatar_url(url: &str) -> String {
    if (url.contains("cdn.discordapp.com") || url.contains("media.discordapp.net"))
        && url.ends_with(".gif")
    {
        format!("{}.png", url.trim_end_matches(".gif"))
    } else {
        url.to_string()
    }
}

/// Fetch an avatar image from a URL and return it as a decoded Pixmap.
pub async fn fetch_avatar(url: &str) -> Result<Pixmap, ImageGenError> {
    let url = normalise_avatar_url(url);
    let response = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| ImageGenError::AvatarFetch(format!("HTTP request failed: {e}")))?;

    if !response.status().is_success() {
        return Err(ImageGenError::AvatarFetch(format!(
            "HTTP {} for avatar URL",
            response.status()
        )));
    }

    // Check Content-Length header if present to reject obviously oversized responses early.
    if let Some(len) = response.content_length() {
        if len as usize > MAX_AVATAR_BYTES {
            return Err(ImageGenError::AvatarFetch(format!(
                "Avatar response too large: {len} bytes"
            )));
        }
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| ImageGenError::AvatarFetch(format!("Failed to read body: {e}")))?;

    if bytes.len() > MAX_AVATAR_BYTES {
        return Err(ImageGenError::AvatarFetch(format!(
            "Avatar response too large: {} bytes",
            bytes.len()
        )));
    }

    decode_image_to_pixmap(&bytes)
}

/// Decode PNG/JPEG/WebP bytes into a tiny-skia Pixmap.
fn decode_image_to_pixmap(data: &[u8]) -> Result<Pixmap, ImageGenError> {
    let img = image::load_from_memory(data)
        .map_err(|e| ImageGenError::ImageProcessing(format!("Image decode error: {e}")))?;

    let rgba = img.to_rgba8();
    let (w, h) = img.dimensions();

    let mut pixmap = Pixmap::new(w, h)
        .ok_or_else(|| ImageGenError::ImageProcessing("Failed to create pixmap".into()))?;

    // Convert from straight alpha to premultiplied alpha
    let src = rgba.as_raw();
    let dst = pixmap.data_mut();
    for i in 0..(w * h) as usize {
        let r = src[i * 4] as u16;
        let g = src[i * 4 + 1] as u16;
        let b = src[i * 4 + 2] as u16;
        let a = src[i * 4 + 3] as u16;
        dst[i * 4] = (r * a / 255) as u8;
        dst[i * 4 + 1] = (g * a / 255) as u8;
        dst[i * 4 + 2] = (b * a / 255) as u8;
        dst[i * 4 + 3] = a as u8;
    }

    Ok(pixmap)
}

/// Decode embedded PNG bytes into a Pixmap.
pub fn decode_embedded_png(data: &[u8]) -> Result<Pixmap, ImageGenError> {
    decode_image_to_pixmap(data)
}

/// Draw a circular-cropped avatar onto a destination pixmap.
/// `cx`, `cy` = center position, `size` = diameter.
pub fn draw_circular_avatar(
    dest: &mut Pixmap,
    avatar: &Pixmap,
    cx: f32,
    cy: f32,
    size: f32,
    border_width: f32,
    border_color: tiny_skia::Color,
) {
    let radius = size / 2.0;

    // Draw shadow under the avatar
    if border_width > 0.0 {
        let border_radius = radius + border_width;

        let mut shadow_paint = Paint::default();
        shadow_paint.set_color(tiny_skia::Color::from_rgba8(0, 0, 0, 115));
        shadow_paint.anti_alias = true;

        if let Some(shadow_path) = {
            let mut pb = PathBuilder::new();
            pb.push_circle(cx + 1.5, cy + 3.0, border_radius);
            pb.finish()
        } {
            dest.fill_path(
                &shadow_path,
                &shadow_paint,
                FillRule::Winding,
                Transform::identity(),
                None,
            );
        }

        // Draw border circle
        let mut paint = Paint::default();
        paint.set_color(border_color);
        paint.anti_alias = true;

        if let Some(path) = {
            let mut pb = PathBuilder::new();
            pb.push_circle(cx, cy, border_radius);
            pb.finish()
        } {
            dest.fill_path(
                &path,
                &paint,
                FillRule::Winding,
                Transform::identity(),
                None,
            );
        }
    }

    // Scale avatar into a temp pixmap, then clip to a circle
    let avatar_w = avatar.width() as f32;
    let avatar_h = avatar.height() as f32;
    let target_size = size.ceil() as u32;

    if let Some(mut temp) = Pixmap::new(target_size, target_size) {
        let temp_scale = size / avatar_w.max(avatar_h);
        let offset_x = (target_size as f32 - avatar_w * temp_scale) / 2.0;
        let offset_y = (target_size as f32 - avatar_h * temp_scale) / 2.0;

        let transform =
            Transform::from_scale(temp_scale, temp_scale).post_translate(offset_x, offset_y);

        // Use a subpixel antialiased mask rather than cutting whole edge pixels away.
        let center = target_size as f32 / 2.0;
        let mut mask = Mask::new(target_size, target_size).unwrap();
        let mut mask_builder = PathBuilder::new();
        mask_builder.push_circle(center, center, center);
        if let Some(mask_path) = mask_builder.finish() {
            mask.fill_path(&mask_path, FillRule::Winding, true, Transform::identity());
        }

        temp.draw_pixmap(
            0,
            0,
            avatar.as_ref(),
            &avatar_paint(),
            transform,
            Some(&mask),
        );

        // Draw the clipped avatar onto destination
        let dest_x = (cx - radius) as i32;
        let dest_y = (cy - radius) as i32;
        dest.draw_pixmap(
            dest_x,
            dest_y,
            temp.as_ref(),
            &PixmapPaint::default(),
            Transform::identity(),
            None,
        );
    }
}

/// Draw a square (non-clipped) avatar onto a destination pixmap.
pub fn draw_square_avatar(
    dest: &mut Pixmap,
    avatar: &Pixmap,
    x: f32,
    y: f32,
    size: f32,
) {
    let avatar_w = avatar.width() as f32;
    let avatar_h = avatar.height() as f32;
    let scale = size / avatar_w.max(avatar_h);

    let transform = Transform::from_scale(scale, scale).post_translate(x, y);

    dest.draw_pixmap(
        0,
        0,
        avatar.as_ref(),
        &avatar_paint(),
        transform,
        None,
    );
}

#[cfg(test)]
mod tests {
    use super::avatar_paint;
    use tiny_skia::FilterQuality;

    #[test]
    fn avatar_scaling_uses_high_quality_resampling() {
        assert_eq!(avatar_paint().quality, FilterQuality::Bicubic);
    }
}
