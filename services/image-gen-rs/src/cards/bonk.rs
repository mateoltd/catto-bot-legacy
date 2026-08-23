use crate::assets;
use crate::avatar::{decode_embedded_png, draw_circular_avatar, fetch_avatar};
use crate::color::parse_css_color;
use crate::error::ImageGenError;
use crate::text::{FontWeight, SharedTextRenderer};
use rand::Rng;
use serde::Deserialize;
use tiny_skia::{Color, Paint, PathBuilder, Pixmap, PixmapPaint, Transform};

const CANVAS_WIDTH: u32 = 800;
const CANVAS_HEIGHT: u32 = 534;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BonkRequest {
    pub bonker_avatar_url: String,
    pub bonked_avatar_url: String,
    pub style: BonkStyle,
    pub visuals: Option<BonkVisuals>,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq)]
pub enum BonkStyle {
    #[serde(alias = "doge")]
    Doge,
    #[serde(alias = "cat")]
    Cat,
    #[serde(alias = "lions")]
    Lions,
    #[serde(alias = "rabbit")]
    Rabbit,
    #[serde(alias = "doge_fatality")]
    DogeFatality,
    #[serde(alias = "capybara")]
    Capybara,
}

impl BonkStyle {
    fn is_fatality(self) -> bool {
        matches!(self, BonkStyle::DogeFatality)
    }
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BonkVisuals {
    #[serde(default = "default_bonk_text")]
    pub bonk_text: String,
    #[serde(default = "default_font_size")]
    pub font_size: f32,
    #[serde(default)]
    pub star_count: u32,
    #[serde(default)]
    pub show_speed_lines: bool,
    #[serde(default)]
    pub show_damage_number: bool,
    #[serde(default = "default_text_color")]
    pub text_color: String,
    #[serde(default = "default_glow_color")]
    pub glow_color: String,
    #[serde(default = "default_stroke_width")]
    pub text_stroke_width: f32,
}

fn default_bonk_text() -> String { "*BONK!*".into() }
fn default_font_size() -> f32 { 44.0 }
fn default_text_color() -> String { "#FFD700".into() }
fn default_glow_color() -> String { "rgba(255,165,0,0.3)".into() }
fn default_stroke_width() -> f32 { 3.0 }

impl Default for BonkVisuals {
    fn default() -> Self {
        Self {
            bonk_text: default_bonk_text(),
            font_size: default_font_size(),
            star_count: 0,
            show_speed_lines: false,
            show_damage_number: false,
            text_color: default_text_color(),
            glow_color: default_glow_color(),
            text_stroke_width: default_stroke_width(),
        }
    }
}

struct PositionConfig {
    bonker_center_x: f32, // percentage
    bonker_center_y: f32,
    bonker_size: f32,
    bonked_center_x: f32,
    bonked_center_y: f32,
    bonked_size: f32,
    bonk_text_x: f32,
    bonk_text_y: f32,
}

fn get_positions(style: BonkStyle) -> PositionConfig {
    match style {
        BonkStyle::Doge => PositionConfig {
            bonker_center_x: 35.0, bonker_center_y: 25.0, bonker_size: 25.0,
            bonked_center_x: 70.0, bonked_center_y: 48.0, bonked_size: 17.0,
            bonk_text_x: 55.0, bonk_text_y: 3.0,
        },
        BonkStyle::Cat => PositionConfig {
            bonker_center_x: 37.0, bonker_center_y: 25.0, bonker_size: 17.0,
            bonked_center_x: 71.0, bonked_center_y: 55.0, bonked_size: 14.0,
            bonk_text_x: 54.0, bonk_text_y: 2.0,
        },
        BonkStyle::Lions => PositionConfig {
            bonker_center_x: 36.0, bonker_center_y: 24.0, bonker_size: 25.0,
            bonked_center_x: 70.0, bonked_center_y: 45.0, bonked_size: 19.0,
            bonk_text_x: 55.0, bonk_text_y: 3.0,
        },
        BonkStyle::Rabbit => PositionConfig {
            bonker_center_x: 35.0, bonker_center_y: 35.0, bonker_size: 25.0,
            bonked_center_x: 68.0, bonked_center_y: 52.0, bonked_size: 17.0,
            bonk_text_x: 54.0, bonk_text_y: 2.0,
        },
        BonkStyle::DogeFatality => PositionConfig {
            bonker_center_x: 35.0, bonker_center_y: 25.0, bonker_size: 25.0,
            bonked_center_x: 86.0, bonked_center_y: 65.0, bonked_size: 15.0,
            bonk_text_x: 55.0, bonk_text_y: 10.0,
        },
        BonkStyle::Capybara => PositionConfig {
            bonker_center_x: 39.0, bonker_center_y: 25.0, bonker_size: 25.0,
            bonked_center_x: 62.0, bonked_center_y: 50.0, bonked_size: 19.0,
            bonk_text_x: 52.0, bonk_text_y: 3.0,
        },
    }
}

fn get_source_image(style: BonkStyle) -> &'static [u8] {
    match style {
        BonkStyle::Doge => assets::bonk::DOGE_SOURCE,
        BonkStyle::Cat => assets::bonk::CAT_SOURCE,
        BonkStyle::Lions => assets::bonk::LIONS_SOURCE,
        BonkStyle::Rabbit => assets::bonk::RABBIT_SOURCE,
        BonkStyle::DogeFatality => assets::bonk::DOGE_FATALITY_SOURCE,
        BonkStyle::Capybara => assets::bonk::CAPY_SOURCE,
    }
}

fn pct(percent: f32, total: u32) -> f32 {
    (percent / 100.0) * total as f32
}

/// Pre-generated random effect data (generated before any .await points).
struct EffectData {
    stars: Vec<(f32, f32, f32)>,           // (x, y, size)
    speed_lines: Vec<(f32, f32, f32, f32)>, // (x, y, angle, len)
    damage_number: Option<(u32, f32, f32)>, // (damage, x, y)
}

fn pre_generate_effects(visuals: &BonkVisuals, config: &PositionConfig) -> EffectData {
    let mut rng = rand::thread_rng();
    let impact_x = pct(config.bonked_center_x, CANVAS_WIDTH);
    let impact_y = pct(config.bonked_center_y, CANVAS_HEIGHT);

    let stars = (0..visuals.star_count).map(|i| {
        let angle = (i as f32 / visuals.star_count.max(1) as f32) * std::f32::consts::TAU
            + rng.gen::<f32>() * 0.5;
        let radius = 50.0 + rng.gen::<f32>() * 70.0;
        let x = (impact_x + angle.cos() * radius).max(0.0).min(CANVAS_WIDTH as f32);
        let y = (impact_y + angle.sin() * radius).max(0.0).min(CANVAS_HEIGHT as f32);
        let size = 6.0 + rng.gen::<f32>() * 10.0;
        (x, y, size)
    }).collect();

    let speed_lines = if visuals.show_speed_lines {
        (0..5).map(|_| {
            let angle: f32 = rng.gen_range(-40.0..-15.0);
            let x = impact_x - 30.0 + rng.gen::<f32>() * 60.0;
            let y = impact_y - 30.0 + rng.gen::<f32>() * 60.0;
            let len: f32 = 25.0 + rng.gen::<f32>() * 45.0;
            (x, y, angle, len)
        }).collect()
    } else {
        Vec::new()
    };

    let damage_number = if visuals.show_damage_number {
        let damage: u32 = rng.gen_range(1000..=9999);
        let dmg_x = if impact_x + 40.0 > CANVAS_WIDTH as f32 - 150.0 {
            impact_x - 140.0
        } else {
            impact_x + 40.0
        };
        let dmg_y = impact_y - 60.0;
        Some((damage, dmg_x, dmg_y))
    } else {
        None
    };

    EffectData { stars, speed_lines, damage_number }
}

pub async fn render_bonk(
    req: &BonkRequest,
    text_renderer: &SharedTextRenderer,
) -> Result<Vec<u8>, ImageGenError> {
    let visuals = req.visuals.clone().unwrap_or_default();
    let config = get_positions(req.style);

    // Pre-generate all random data before any .await (ThreadRng is !Send)
    let effects = pre_generate_effects(&visuals, &config);

    // Fetch avatars in parallel
    let (bonker_avatar, bonked_avatar) = tokio::join!(
        fetch_avatar(&req.bonker_avatar_url),
        fetch_avatar(&req.bonked_avatar_url)
    );
    let bonker_avatar = bonker_avatar?;
    let bonked_avatar = bonked_avatar?;

    // Decode source image and bat overlay
    let source_img = decode_embedded_png(get_source_image(req.style))?;
    let bat_img = decode_embedded_png(assets::bonk::BAT_OVERLAY)?;

    // Create canvas
    let mut canvas = Pixmap::new(CANVAS_WIDTH, CANVAS_HEIGHT)
        .ok_or_else(|| ImageGenError::Rendering("Failed to create canvas".into()))?;

    // 1. Draw source image (background)
    draw_scaled(&mut canvas, &source_img, 0.0, 0.0, CANVAS_WIDTH as f32, CANVAS_HEIGHT as f32);

    // 2. Draw bonker avatar (circular, z-index 2)
    let bonker_size_px = pct(config.bonker_size, CANVAS_WIDTH);
    let bonker_cx = pct(config.bonker_center_x, CANVAS_WIDTH);
    let bonker_cy = pct(config.bonker_center_y, CANVAS_HEIGHT);

    draw_circular_avatar(
        &mut canvas,
        &bonker_avatar,
        bonker_cx,
        bonker_cy,
        bonker_size_px,
        3.0,
        Color::from_rgba8(255, 255, 255, 217), // rgba(255,255,255,0.85)
    );

    // 3. Draw bonked avatar (circular, z-index 2)
    let bonked_size_px = pct(config.bonked_size, CANVAS_WIDTH);
    let bonked_cx = pct(config.bonked_center_x, CANVAS_WIDTH);
    let bonked_cy = pct(config.bonked_center_y, CANVAS_HEIGHT);

    draw_circular_avatar(
        &mut canvas,
        &bonked_avatar,
        bonked_cx,
        bonked_cy,
        bonked_size_px,
        3.0,
        Color::from_rgba8(255, 255, 255, 217),
    );

    // 4. Draw bat overlay (z-index 5)
    if req.style.is_fatality() {
        // For fatality: transform-origin:30% 20%; transform:rotate(15deg) translateX(10%);
        let origin_x = CANVAS_WIDTH as f32 * 0.30;
        let origin_y = CANVAS_HEIGHT as f32 * 0.20;
        let angle_rad = 15.0_f32.to_radians();
        let tx = CANVAS_WIDTH as f32 * 0.10;

        let transform = Transform::identity()
            .post_translate(-origin_x, -origin_y)
            .post_rotate(angle_rad.to_degrees())
            .post_translate(origin_x + tx, origin_y);

        let sx = CANVAS_WIDTH as f32 / bat_img.width() as f32;
        let sy = CANVAS_HEIGHT as f32 / bat_img.height() as f32;
        let scale_transform = Transform::from_scale(sx, sy).post_concat(transform);

        canvas.draw_pixmap(
            0, 0,
            bat_img.as_ref(),
            &PixmapPaint::default(),
            scale_transform,
            None,
        );
    } else {
        draw_scaled(&mut canvas, &bat_img, 0.0, 0.0, CANVAS_WIDTH as f32, CANVAS_HEIGHT as f32);
    }

    // 5. Draw impact effects (z-index 7-8): speed lines, stars
    draw_impact_effects(&mut canvas, &effects);

    // 6. Draw bonk text (z-index 10)
    {
        let text_x = pct(config.bonk_text_x, CANVAS_WIDTH);
        let text_y = pct(config.bonk_text_y, CANVAS_HEIGHT);
        let text_color = parse_css_color(&visuals.text_color)
            .unwrap_or(Color::from_rgba8(255, 215, 0, 255));
        let glow_color = parse_css_color(&visuals.glow_color)
            .unwrap_or(Color::from_rgba8(255, 165, 0, 77));
        let stroke_color = Color::from_rgba8(0, 0, 0, 255);

        // Clean display text (remove * markers)
        let display_text = visuals.bonk_text.replace('*', "");

        let mut renderer = text_renderer.lock().unwrap();

        // Render stroke (black outline) - draw text multiple times offset
        let stroke_w = visuals.text_stroke_width;
        let offsets: &[(f32, f32)] = &[
            (-stroke_w, -stroke_w), (0.0, -stroke_w), (stroke_w, -stroke_w),
            (-stroke_w, 0.0),                          (stroke_w, 0.0),
            (-stroke_w, stroke_w),  (0.0, stroke_w),  (stroke_w, stroke_w),
        ];

        // Render the text once for measurement
        let (text_pixmap, tw, _th) = renderer.render_text(
            &display_text, "Anton", visuals.font_size, FontWeight::Regular,
            text_color, CANVAS_WIDTH as f32,
        )?;

        // Apply -12deg rotation around the text position
        let angle = -12.0_f32;
        let base_transform = Transform::identity()
            .post_translate(-tw / 2.0, 0.0)
            .post_rotate(angle)
            .post_translate(text_x, text_y);

        // Draw glow (blurred text-shadow effect) — draw slightly larger/offset versions
        if glow_color.alpha() > 0.01 {
            let (glow_pixmap, _, _) = renderer.render_text(
                &display_text, "Anton", visuals.font_size, FontWeight::Regular,
                glow_color, CANVAS_WIDTH as f32,
            )?;
            for &(dx, dy) in &[(0.0_f32, 0.0_f32), (2.0, 2.0), (-2.0, -2.0)] {
                let glow_transform = base_transform.post_translate(dx, dy);
                canvas.draw_pixmap(
                    0, 0,
                    glow_pixmap.as_ref(),
                    &PixmapPaint::default(),
                    glow_transform,
                    None,
                );
            }
        }

        // Draw stroke outlines
        let (stroke_pixmap, _, _) = renderer.render_text(
            &display_text, "Anton", visuals.font_size, FontWeight::Regular,
            stroke_color, CANVAS_WIDTH as f32,
        )?;
        for &(dx, dy) in offsets {
            let stroke_transform = base_transform.post_translate(dx, dy);
            canvas.draw_pixmap(
                0, 0,
                stroke_pixmap.as_ref(),
                &PixmapPaint::default(),
                stroke_transform,
                None,
            );
        }

        // Draw drop shadow
        let shadow_color = Color::from_rgba8(0, 0, 0, 128);
        let (shadow_pixmap, _, _) = renderer.render_text(
            &display_text, "Anton", visuals.font_size, FontWeight::Regular,
            shadow_color, CANVAS_WIDTH as f32,
        )?;
        let shadow_transform = base_transform.post_translate(3.0, 3.0);
        canvas.draw_pixmap(
            0, 0,
            shadow_pixmap.as_ref(),
            &PixmapPaint::default(),
            shadow_transform,
            None,
        );

        // Draw main text
        canvas.draw_pixmap(
            0, 0,
            text_pixmap.as_ref(),
            &PixmapPaint::default(),
            base_transform,
            None,
        );
    }

    // 7. Draw damage number (z-index 11)
    if let Some((damage, dmg_x, dmg_y)) = effects.damage_number {
        let damage_text = format!("{}!", damage);
        let mut renderer = text_renderer.lock().unwrap();

        let dmg_color = Color::from_rgba8(255, 51, 51, 255);
        let stroke_color = Color::from_rgba8(0, 0, 0, 255);

        // Draw stroke
        let (stroke_pm, _, _) = renderer.render_text(
            &damage_text, "Anton", 32.0, FontWeight::Regular,
            stroke_color, 200.0,
        )?;
        let transform = Transform::identity().post_rotate(-15.0).post_translate(dmg_x, dmg_y);
        for &(dx, dy) in &[(-2.0_f32, -2.0_f32), (2.0, -2.0), (-2.0, 2.0), (2.0, 2.0)] {
            let t = transform.post_translate(dx, dy);
            canvas.draw_pixmap(0, 0, stroke_pm.as_ref(), &PixmapPaint::default(), t, None);
        }

        // Draw main damage number
        let (dmg_pm, _, _) = renderer.render_text(
            &damage_text, "Anton", 32.0, FontWeight::Regular,
            dmg_color, 200.0,
        )?;
        canvas.draw_pixmap(0, 0, dmg_pm.as_ref(), &PixmapPaint::default(), transform, None);
    }

    // Encode to PNG
    let png_data = canvas.encode_png()
        .map_err(|e| ImageGenError::Rendering(format!("PNG encode error: {e}")))?;

    Ok(png_data)
}

fn draw_scaled(dest: &mut Pixmap, src: &Pixmap, x: f32, y: f32, w: f32, h: f32) {
    let sx = w / src.width() as f32;
    let sy = h / src.height() as f32;
    let transform = Transform::from_scale(sx, sy).post_translate(x, y);
    dest.draw_pixmap(0, 0, src.as_ref(), &PixmapPaint::default(), transform, None);
}

fn draw_impact_effects(canvas: &mut Pixmap, effects: &EffectData) {
    // Draw speed lines (z-index 7)
    let line_color = Color::from_rgba8(255, 255, 255, 153);
    for &(x, y, angle, len) in &effects.speed_lines {
        let mut paint = Paint::default();
        paint.set_color(line_color);
        paint.anti_alias = true;

        let angle_rad = angle.to_radians();
        let end_x = x + len * angle_rad.cos();
        let end_y = y + len * angle_rad.sin();

        let mut pb = PathBuilder::new();
        pb.move_to(x, y);
        pb.line_to(end_x, end_y);
        if let Some(path) = pb.finish() {
            let mut stroke = tiny_skia::Stroke::default();
            stroke.width = 3.0;
            canvas.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
        }
    }

    // Draw stars (z-index 8)
    let star_color = Color::from_rgba8(255, 215, 0, 200);
    for &(x, y, size) in &effects.stars {
        let mut paint = Paint::default();
        paint.set_color(star_color);
        paint.anti_alias = true;

        // Cross pattern for star
        for &(dx1, dy1, dx2, dy2, w) in &[
            (-size, 0.0, size, 0.0, 2.0),
            (0.0, -size, 0.0, size, 2.0),
            (-size * 0.7, -size * 0.7, size * 0.7, size * 0.7, 1.5),
            (size * 0.7, -size * 0.7, -size * 0.7, size * 0.7, 1.5),
        ] {
            let mut pb = PathBuilder::new();
            pb.move_to(x + dx1, y + dy1);
            pb.line_to(x + dx2, y + dy2);
            if let Some(path) = pb.finish() {
                let mut stroke = tiny_skia::Stroke::default();
                stroke.width = w;
                canvas.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
            }
        }
    }
}
