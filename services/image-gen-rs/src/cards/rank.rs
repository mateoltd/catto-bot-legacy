use super::common::{
    draw_rect_filled, draw_rounded_rect_filled, format_number, sanitize_text, truncate_username,
};
use crate::avatar::{draw_circular_avatar, fetch_avatar};
use crate::error::ImageGenError;
use crate::text::{FontWeight, SharedTextRenderer, TextRenderer};
use serde::Deserialize;
use tiny_skia::{Color, Pixmap, PixmapPaint, Transform};

const CARD_WIDTH: u32 = 720;
const CARD_HEIGHT: u32 = 423;

fn surface() -> Color {
    Color::from_rgba8(243, 239, 247, 255)
}
fn white() -> Color {
    Color::from_rgba8(255, 255, 255, 255)
}
fn ink() -> Color {
    Color::from_rgba8(37, 34, 42, 255)
}
fn muted() -> Color {
    Color::from_rgba8(116, 111, 123, 255)
}
fn purple() -> Color {
    Color::from_rgba8(115, 83, 219, 255)
}
fn lavender() -> Color {
    Color::from_rgba8(233, 226, 255, 255)
}
fn lavender_strong() -> Color {
    Color::from_rgba8(215, 204, 251, 255)
}
fn stats() -> Color {
    Color::from_rgba8(221, 210, 234, 255)
}
fn stats_line() -> Color {
    Color::from_rgba8(195, 185, 207, 255)
}
fn white_muted() -> Color {
    Color::from_rgba8(221, 208, 249, 255)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankCardRequest {
    pub username: String,
    pub avatar_url: String,
    pub level: u32,
    #[serde(alias = "currentXP")]
    pub current_xp: u64,
    #[serde(alias = "requiredXP")]
    pub required_xp: u64,
    pub rank: u32,
    pub total_members: u32,
    #[serde(default)]
    pub accent_color: Option<String>,
    #[serde(default, alias = "messagesXP")]
    pub messages_xp: Option<u64>,
    #[serde(default, alias = "voiceXP")]
    pub voice_xp: Option<u64>,
    #[serde(default, alias = "reactionsXP")]
    pub reactions_xp: Option<u64>,
    #[serde(default, alias = "commandsXP")]
    pub commands_xp: Option<u64>,
    #[serde(default)]
    pub most_active_channel: Option<String>,
    #[serde(default, alias = "last7DaysXP")]
    pub last_7_days_xp: Option<u64>,
    #[serde(default, alias = "last30DaysXP")]
    pub last_30_days_xp: Option<u64>,
    #[serde(default)]
    pub streak: Option<u32>,
    #[serde(default)]
    pub member_since: Option<String>,
    #[serde(default)]
    pub is_voice_card: Option<bool>,
}

fn comma_number(n: u64) -> String {
    let digits = n.to_string();
    let mut formatted = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, character) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            formatted.push(',');
        }
        formatted.push(character);
    }
    formatted
}

fn draw_text(
    canvas: &mut Pixmap,
    renderer: &mut TextRenderer,
    text: &str,
    x: f32,
    y: f32,
    max_width: f32,
    size: f32,
    weight: FontWeight,
    color: Color,
) -> Result<(f32, f32), ImageGenError> {
    let (pixmap, width, height) =
        renderer.render_text(text, "DM Sans", size, weight, color, max_width)?;
    canvas.draw_pixmap(
        x.round() as i32,
        y.round() as i32,
        pixmap.as_ref(),
        &PixmapPaint::default(),
        Transform::identity(),
        None,
    );
    Ok((width, height))
}

fn draw_text_right(
    canvas: &mut Pixmap,
    renderer: &mut TextRenderer,
    text: &str,
    right: f32,
    y: f32,
    max_width: f32,
    size: f32,
    weight: FontWeight,
    color: Color,
) -> Result<(f32, f32), ImageGenError> {
    let width = renderer.measure_text(text, "DM Sans", size, weight);
    draw_text(
        canvas,
        renderer,
        text,
        right - width,
        y,
        max_width,
        size,
        weight,
        color,
    )
}

#[allow(non_snake_case)]
pub async fn render_rank_card(
    req: &RankCardRequest,
    text_renderer: &SharedTextRenderer,
) -> Result<Vec<u8>, ImageGenError> {
    let SURFACE = surface();
    let WHITE = white();
    let INK = ink();
    let MUTED = muted();
    let PURPLE = purple();
    let LAVENDER = lavender();
    let LAVENDER_STRONG = lavender_strong();
    let STATS = stats();
    let STATS_LINE = stats_line();
    let WHITE_MUTED = white_muted();

    let avatar = fetch_avatar(&req.avatar_url).await?;
    let mut canvas = Pixmap::new(CARD_WIDTH, CARD_HEIGHT)
        .ok_or_else(|| ImageGenError::Rendering("Failed to create canvas".into()))?;

    draw_rounded_rect_filled(
        &mut canvas,
        0.0,
        0.0,
        CARD_WIDTH as f32,
        CARD_HEIGHT as f32,
        32.0,
        SURFACE,
    );

    draw_circular_avatar(&mut canvas, &avatar, 52.0, 52.0, 48.0, 0.0, LAVENDER);

    draw_rounded_rect_filled(&mut canvas, 20.0, 98.0, 506.0, 198.0, 24.0, WHITE);
    draw_rounded_rect_filled(&mut canvas, 540.0, 98.0, 160.0, 198.0, 24.0, PURPLE);
    draw_rounded_rect_filled(&mut canvas, 20.0, 310.0, 680.0, 93.0, 20.0, STATS);

    let progress = if req.required_xp == 0 {
        0.0
    } else {
        (req.current_xp as f32 / req.required_xp as f32).clamp(0.0, 1.0)
    };
    draw_rounded_rect_filled(&mut canvas, 44.0, 227.0, 458.0, 11.0, 6.0, LAVENDER_STRONG);
    if progress > 0.0 {
        draw_rounded_rect_filled(
            &mut canvas,
            44.0,
            227.0,
            458.0 * progress,
            11.0,
            6.0,
            PURPLE,
        );
    }

    // The stats remain a single card; these separators are deliberately low contrast.
    for x in [200.0, 360.0, 520.0] {
        draw_rect_filled(&mut canvas, x, 322.0, 1.0, 69.0, STATS_LINE);
    }

    let total_xp = req.current_xp + req.level as u64 * req.required_xp;
    let current_level = format!("{:02}", req.level);
    let next_level = format!("{:02}", req.level.saturating_add(1));
    let recent_xp = format!("+{}", comma_number(req.last_7_days_xp.unwrap_or(0)));
    let progress_percent = (progress * 100.0).round() as u32;
    let member_since = sanitize_text(req.member_since.as_deref().unwrap_or("Unknown"));
    let username = truncate_username(&sanitize_text(&req.username), 26, 23);
    let channel = truncate_username(
        &sanitize_text(req.most_active_channel.as_deref().unwrap_or("N/A")),
        18,
        15,
    );
    let is_voice = req.is_voice_card.unwrap_or(false);
    let messages_label = if is_voice { "Total time" } else { "Messages" };
    let voice_label = if is_voice { "Streaming" } else { "Voice" };
    let streak = match req.streak.unwrap_or(0) {
        1 => "1 day".to_string(),
        days => format!("{days} days"),
    };

    {
        let mut renderer = text_renderer.lock().unwrap();

        draw_text(
            &mut canvas,
            &mut renderer,
            &username,
            90.0,
            32.0,
            400.0,
            21.0,
            FontWeight::Medium,
            INK,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            &format!("Member since {member_since}"),
            90.0,
            61.0,
            420.0,
            15.0,
            FontWeight::Regular,
            MUTED,
        )?;

        draw_text_right(
            &mut canvas,
            &mut renderer,
            &format!("#{}", req.rank),
            692.0,
            28.0,
            120.0,
            22.0,
            FontWeight::Medium,
            PURPLE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "Server rank",
            692.0,
            59.0,
            120.0,
            15.0,
            FontWeight::Regular,
            PURPLE,
        )?;

        draw_text(
            &mut canvas,
            &mut renderer,
            &comma_number(total_xp),
            44.0,
            120.0,
            210.0,
            30.0,
            FontWeight::Regular,
            INK,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            "Total XP",
            44.0,
            158.0,
            150.0,
            16.0,
            FontWeight::Medium,
            INK,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            &recent_xp,
            502.0,
            128.0,
            150.0,
            20.0,
            FontWeight::Medium,
            PURPLE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "Last 7 days",
            502.0,
            158.0,
            150.0,
            15.0,
            FontWeight::Regular,
            PURPLE,
        )?;

        draw_text(
            &mut canvas,
            &mut renderer,
            &format!("Progress to level {}", req.level.saturating_add(1)),
            44.0,
            198.0,
            250.0,
            15.0,
            FontWeight::Medium,
            INK,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            &format!("{progress_percent}%"),
            502.0,
            198.0,
            60.0,
            14.0,
            FontWeight::Medium,
            INK,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            &format!(
                "{} / {} XP",
                format_number(req.current_xp),
                format_number(req.required_xp)
            ),
            44.0,
            249.0,
            300.0,
            15.0,
            FontWeight::Regular,
            MUTED,
        )?;

        draw_text(
            &mut canvas,
            &mut renderer,
            &current_level,
            564.0,
            119.0,
            82.0,
            56.0,
            FontWeight::Regular,
            WHITE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            &next_level,
            676.0,
            126.0,
            42.0,
            26.0,
            FontWeight::Regular,
            WHITE,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            "Current",
            564.0,
            255.0,
            70.0,
            15.0,
            FontWeight::Regular,
            WHITE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "Next",
            676.0,
            255.0,
            55.0,
            15.0,
            FontWeight::Regular,
            WHITE_MUTED,
        )?;

        let detail_values = [
            comma_number(req.messages_xp.unwrap_or(0)),
            comma_number(req.voice_xp.unwrap_or(0)),
            channel,
            streak,
        ];
        let detail_labels = [messages_label, voice_label, "Most active in", "Streak"];
        let detail_lefts = [56.0, 216.0, 376.0, 536.0];
        let detail_widths = [128.0; 4];

        for index in 0..4 {
            draw_text(
                &mut canvas,
                &mut renderer,
                &detail_values[index],
                detail_lefts[index],
                330.0,
                detail_widths[index],
                20.0,
                FontWeight::Medium,
                INK,
            )?;
            draw_text(
                &mut canvas,
                &mut renderer,
                detail_labels[index],
                detail_lefts[index],
                361.0,
                detail_widths[index],
                14.0,
                FontWeight::Regular,
                MUTED,
            )?;
        }
    }

    canvas
        .encode_png()
        .map_err(|error| ImageGenError::Rendering(format!("PNG encode error: {error}")))
}
