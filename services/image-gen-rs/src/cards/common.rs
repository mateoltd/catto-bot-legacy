use crate::text::{FontWeight, TextRenderer};
use tiny_skia::{Color, FillRule, Paint, PathBuilder, Pixmap, Rect, Transform};

/// Fill a rectangle with a solid color.
pub fn draw_rect_filled(canvas: &mut Pixmap, x: f32, y: f32, w: f32, h: f32, color: Color) {
    if let Some(rect) = Rect::from_xywh(x, y, w, h) {
        let mut paint = Paint::default();
        paint.set_color(color);
        canvas.fill_rect(rect, &paint, Transform::identity(), None);
    }
}

/// Fill a rounded rectangle with a solid color.
pub fn draw_rounded_rect_filled(
    canvas: &mut Pixmap,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    radius: f32,
    color: Color,
) {
    if w <= 0.0 || h <= 0.0 {
        return;
    }

    let radius = radius.max(0.0).min(w / 2.0).min(h / 2.0);
    if radius == 0.0 {
        draw_rect_filled(canvas, x, y, w, h, color);
        return;
    }

    let mut pb = PathBuilder::new();
    pb.move_to(x + radius, y);
    pb.line_to(x + w - radius, y);
    pb.quad_to(x + w, y, x + w, y + radius);
    pb.line_to(x + w, y + h - radius);
    pb.quad_to(x + w, y + h, x + w - radius, y + h);
    pb.line_to(x + radius, y + h);
    pb.quad_to(x, y + h, x, y + h - radius);
    pb.line_to(x, y + radius);
    pb.quad_to(x, y, x + radius, y);
    pb.close();

    if let Some(path) = pb.finish() {
        let mut paint = Paint::default();
        paint.set_color(color);
        paint.anti_alias = true;
        canvas.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);
    }
}

/// Stroke a rectangle outline.
pub fn draw_rect_outline(canvas: &mut Pixmap, x: f32, y: f32, w: f32, h: f32, color: Color, width: f32) {
    let mut pb = PathBuilder::new();
    pb.move_to(x, y);
    pb.line_to(x + w, y);
    pb.line_to(x + w, y + h);
    pb.line_to(x, y + h);
    pb.close();
    if let Some(path) = pb.finish() {
        let mut paint = Paint::default();
        paint.set_color(color);
        let mut stroke = tiny_skia::Stroke::default();
        stroke.width = width;
        canvas.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
    }
}

/// Draw a 1px horizontal line.
pub fn draw_hline(canvas: &mut Pixmap, x1: f32, x2: f32, y: f32, color: Color) {
    if let Some(rect) = Rect::from_xywh(x1, y, x2 - x1, 1.0) {
        let mut paint = Paint::default();
        paint.set_color(color);
        canvas.fill_rect(rect, &paint, Transform::identity(), None);
    }
}

/// Format a number with comma separators (e.g. 1,234,567) or M suffix for millions.
pub fn format_number(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        let s = n.to_string();
        let mut result = String::new();
        for (i, c) in s.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 {
                result.push(',');
            }
            result.push(c);
        }
        result.chars().rev().collect()
    } else {
        n.to_string()
    }
}

/// Center an element of `elem_w` inside a container starting at `start` with width `container_w`.
pub fn center_in(start: f32, container_w: f32, elem_w: f32) -> f32 {
    start + (container_w - elem_w) / 2.0
}

/// Right-align an element of `elem_w` inside a container starting at `start` with width `container_w`.
pub fn right_align(start: f32, container_w: f32, elem_w: f32) -> f32 {
    start + container_w - elem_w
}

/// Truncate a string to `max_chars` characters (UTF-8 safe) and append "..." if truncated.
pub fn truncate_username(name: &str, max_display: usize, max_with_ellipsis: usize) -> String {
    if name.chars().count() > max_display {
        let truncated: String = name.chars().take(max_with_ellipsis).collect();
        format!("{truncated}...")
    } else {
        name.to_string()
    }
}

/// Draw a small filled circle (dot separator, icon stand-in, etc.).
pub fn draw_dot(canvas: &mut Pixmap, cx: f32, cy: f32, radius: f32, color: Color) {
    let mut pb = PathBuilder::new();
    pb.push_circle(cx, cy, radius);
    if let Some(path) = pb.finish() {
        let mut paint = Paint::default();
        paint.set_color(color);
        paint.anti_alias = true;
        canvas.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);
    }
}

/// Preserve user-visible Unicode while forcing text into a single normalized line.
pub fn sanitize_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn fit_single_line(
    renderer: &mut TextRenderer,
    text: &str,
    max_width: f32,
    preferred_size: f32,
    minimum_size: f32,
    weight: FontWeight,
) -> (String, f32) {
    let mut size = preferred_size;
    while size > minimum_size && renderer.measure_text(text, "DM Sans", size, weight) > max_width {
        size -= 0.5;
    }

    if renderer.measure_text(text, "DM Sans", size, weight) <= max_width {
        return (text.to_string(), size);
    }

    let mut characters: Vec<char> = text.chars().collect();
    while !characters.is_empty() {
        characters.pop();
        let candidate = format!("{}...", characters.iter().collect::<String>().trim_end());
        if renderer.measure_text(&candidate, "DM Sans", size, weight) <= max_width {
            return (candidate, size);
        }
    }

    ("...".to_string(), size)
}

#[cfg(test)]
mod tests {
    use super::sanitize_text;

    #[test]
    fn sanitize_text_preserves_unicode_and_normalizes_whitespace() {
        assert_eq!(sanitize_text("  Café\n東京\tПривет  "), "Café 東京 Привет");
    }
}
