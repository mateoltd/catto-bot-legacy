use super::common::{
    draw_rect_filled, draw_rounded_rect_filled, fit_single_line, format_number, sanitize_text,
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

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RankCardType {
    Text,
    Voice,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityState {
    Available,
    None,
    Unavailable,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankCardRequest {
    pub username: String,
    pub avatar_url: String,
    pub card_type: RankCardType,
    #[serde(alias = "totalXP")]
    pub total_xp: u64,
    pub level: u32,
    #[serde(alias = "currentXP")]
    pub current_xp: u64,
    #[serde(alias = "requiredXP")]
    pub required_xp: u64,
    pub max_level: bool,
    pub rank: u32,
    pub primary_value: u64,
    pub secondary_value: u64,
    pub most_active_channel: Option<String>,
    pub activity_state: ActivityState,
    pub last_7_days_value: u64,
    pub streak: u32,
    pub member_since: String,
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

fn format_duration(minutes: u64) -> String {
    if minutes < 60 {
        return format!("{minutes} min");
    }

    let hours = minutes / 60;
    let remaining_minutes = minutes % 60;
    if remaining_minutes == 0 {
        format!("{hours}h")
    } else {
        format!("{hours}h {remaining_minutes}m")
    }
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

    let progress = if req.max_level {
        1.0
    } else if req.required_xp == 0 {
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

    let current_level = format!("{:02}", req.level);
    let next_level = if req.max_level {
        "MAX".to_string()
    } else {
        format!("{:02}", req.level.saturating_add(1))
    };
    let is_voice = matches!(req.card_type, RankCardType::Voice);
    let recent_value = if is_voice {
        format_duration(req.last_7_days_value)
    } else {
        format!("{} XP", comma_number(req.last_7_days_value))
    };
    let progress_percent = (progress * 100.0).round() as u32;
    let member_since = sanitize_text(&req.member_since);
    let username = sanitize_text(&req.username);
    if username.is_empty() || member_since.is_empty() {
        return Err(ImageGenError::Rendering(
            "Rank card username and member date must not be empty".into(),
        ));
    }

    let (activity_value, activity_label) = match req.activity_state {
        ActivityState::Available => {
            let channel = sanitize_text(req.most_active_channel.as_deref().unwrap_or(""));
            if channel.is_empty() {
                ("Channel unavailable".to_string(), "Last 30 days")
            } else {
                (channel, "Most active in")
            }
        }
        ActivityState::None => ("No recent activity".to_string(), "Last 30 days"),
        ActivityState::Unavailable => ("Channel unavailable".to_string(), "Last 30 days"),
    };
    let primary_value = comma_number(req.primary_value);
    let secondary_value = if is_voice {
        format_duration(req.secondary_value)
    } else {
        comma_number(req.secondary_value)
    };
    let primary_label = if is_voice { "Voice XP" } else { "Message XP" };
    let secondary_label = if is_voice {
        "Time in voice"
    } else {
        "Voice XP"
    };
    let streak = match req.streak {
        0 => "No streak".to_string(),
        1 => "1 day".to_string(),
        days => format!("{days} days"),
    };
    let progress_label = if req.max_level {
        "Maximum level".to_string()
    } else {
        format!("Progress to level {}", req.level.saturating_add(1))
    };
    let progress_detail = if req.max_level {
        "Maximum level reached".to_string()
    } else {
        format!(
            "{} / {} XP",
            format_number(req.current_xp),
            format_number(req.required_xp)
        )
    };

    {
        let mut renderer = text_renderer.lock().unwrap();

        let (username, username_size) = fit_single_line(
            &mut renderer,
            &username,
            400.0,
            21.0,
            15.0,
            FontWeight::Medium,
        );
        let member_text = format!("Member since {member_since}");
        let (member_text, member_size) = fit_single_line(
            &mut renderer,
            &member_text,
            420.0,
            15.0,
            12.0,
            FontWeight::Regular,
        );
        let rank_text = format!("#{}", req.rank);
        let (rank_text, rank_size) = fit_single_line(
            &mut renderer,
            &rank_text,
            120.0,
            22.0,
            14.0,
            FontWeight::Medium,
        );
        let total_text = comma_number(req.total_xp);
        let (total_text, total_size) = fit_single_line(
            &mut renderer,
            &total_text,
            210.0,
            30.0,
            20.0,
            FontWeight::Regular,
        );
        let (recent_value, recent_size) = fit_single_line(
            &mut renderer,
            &recent_value,
            150.0,
            20.0,
            14.0,
            FontWeight::Medium,
        );

        draw_text(
            &mut canvas,
            &mut renderer,
            &username,
            90.0,
            32.0,
            400.0,
            username_size,
            FontWeight::Medium,
            INK,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            &member_text,
            90.0,
            61.0,
            420.0,
            member_size,
            FontWeight::Regular,
            MUTED,
        )?;

        draw_text_right(
            &mut canvas,
            &mut renderer,
            &rank_text,
            692.0,
            28.0,
            120.0,
            rank_size,
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
            &total_text,
            44.0,
            120.0,
            210.0,
            total_size,
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
            &recent_value,
            502.0,
            128.0,
            150.0,
            recent_size,
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
            &progress_label,
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
            &progress_detail,
            44.0,
            249.0,
            300.0,
            15.0,
            FontWeight::Regular,
            MUTED,
        )?;

        let (current_level, current_level_size) = fit_single_line(
            &mut renderer,
            &current_level,
            70.0,
            56.0,
            28.0,
            FontWeight::Regular,
        );
        let (next_level, next_level_size) = fit_single_line(
            &mut renderer,
            &next_level,
            42.0,
            if req.max_level { 18.0 } else { 26.0 },
            14.0,
            FontWeight::Regular,
        );

        draw_text(
            &mut canvas,
            &mut renderer,
            &current_level,
            564.0,
            119.0,
            82.0,
            current_level_size,
            FontWeight::Regular,
            WHITE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            &next_level,
            684.0,
            126.0,
            42.0,
            next_level_size,
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
            if req.max_level { "Status" } else { "Next" },
            684.0,
            255.0,
            55.0,
            15.0,
            FontWeight::Regular,
            WHITE_MUTED,
        )?;

        let raw_detail_values = [primary_value, secondary_value, activity_value, streak];
        let detail_labels = [primary_label, secondary_label, activity_label, "Streak"];
        let detail_lefts = [56.0, 216.0, 376.0, 536.0];
        let detail_widths = [128.0; 4];

        for index in 0..4 {
            let (value, size) = fit_single_line(
                &mut renderer,
                &raw_detail_values[index],
                detail_widths[index],
                20.0,
                13.0,
                FontWeight::Medium,
            );
            draw_text(
                &mut canvas,
                &mut renderer,
                &value,
                detail_lefts[index],
                330.0,
                detail_widths[index],
                size,
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

#[cfg(test)]
mod tests {
    use super::{format_duration, RankCardRequest};

    #[test]
    fn formats_voice_minutes_with_explicit_units() {
        assert_eq!(format_duration(0), "0 min");
        assert_eq!(format_duration(60), "1h");
        assert_eq!(format_duration(185), "3h 5m");
    }

    #[test]
    fn request_uses_authoritative_total_xp() {
        let request: RankCardRequest = serde_json::from_value(serde_json::json!({
            "username": "member",
            "avatarUrl": "https://cdn.discordapp.com/avatar.png",
            "cardType": "text",
            "totalXP": 3782,
            "level": 8,
            "currentXP": 162,
            "requiredXP": 955,
            "maxLevel": false,
            "rank": 28,
            "primaryValue": 3782,
            "secondaryValue": 0,
            "activityState": "none",
            "last7DaysValue": 0,
            "streak": 0,
            "memberSince": "Mar 2026"
        }))
        .expect("valid request");

        assert_eq!(request.total_xp, 3782);
    }
}
