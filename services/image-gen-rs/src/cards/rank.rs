use crate::avatar::{draw_square_avatar, fetch_avatar};
use crate::error::ImageGenError;
use crate::text::{FontWeight, SharedTextRenderer};
use super::common::{draw_hline, draw_rect_filled, draw_rect_outline, format_number, right_align, sanitize_text};
use serde::Deserialize;
use tiny_skia::{Color, Pixmap, PixmapPaint, Transform};

// Canvas
const CARD_WIDTH: u32 = 934;

// Padding
const PAD_X: f32 = 40.0;
const PAD_Y: f32 = 32.0;

// Section dimensions
const AVATAR_SIZE: f32 = 64.0;
const HEADER_BOTTOM_GAP: f32 = 16.0;
const DIVIDER_GAP: f32 = 20.0;
const SECTION_LABEL_H: f32 = 16.0;
const LABEL_GAP: f32 = 12.0;
const STAT_BOX_H: f32 = 80.0;
const STAT_BOX_GAP: f32 = 16.0;
const SECTION_GAP: f32 = 24.0;
const PROGRESS_LABEL_H: f32 = 16.0;
const PROGRESS_GAP: f32 = 8.0;
const PROGRESS_BAR_H: f32 = 24.0;
const BREAKDOWN_H: f32 = 200.0;
const BREAKDOWN_GAP: f32 = 24.0;
const STAT_BOX_PAD: f32 = 16.0;

// Theme colors (GitHub dark)
fn bg_color() -> Color { Color::from_rgba8(13, 17, 23, 255) }
fn border_color() -> Color { Color::from_rgba8(33, 38, 45, 255) }
fn text_primary() -> Color { Color::from_rgba8(201, 209, 217, 255) }
fn text_secondary() -> Color { Color::from_rgba8(110, 118, 129, 255) }
fn text_muted() -> Color { Color::from_rgba8(155, 164, 174, 255) }
fn box_bg() -> Color { Color::from_rgba8(22, 27, 34, 255) }
fn accent_green() -> Color { Color::from_rgba8(124, 152, 133, 255) }
fn bar_messages() -> Color { Color::from_rgba8(124, 152, 133, 255) }
fn bar_voice() -> Color { Color::from_rgba8(107, 140, 122, 255) }
fn bar_reactions() -> Color { Color::from_rgba8(90, 125, 106, 255) }
fn bar_commands() -> Color { Color::from_rgba8(74, 109, 90, 255) }

fn content_width() -> f32 {
    CARD_WIDTH as f32 - PAD_X * 2.0
}

fn compute_card_height() -> u32 {
    (PAD_Y
        + AVATAR_SIZE + HEADER_BOTTOM_GAP       // header
        + 1.0 + DIVIDER_GAP                     // divider + gap
        + SECTION_LABEL_H + LABEL_GAP            // "YOUR STATS"
        + STAT_BOX_H + SECTION_GAP               // stat boxes
        + PROGRESS_LABEL_H + PROGRESS_GAP         // progress label
        + PROGRESS_BAR_H + SECTION_GAP             // progress bar
        + BREAKDOWN_H                              // breakdown panels
        + PAD_Y                                    // bottom padding
    ).ceil() as u32
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

pub async fn render_rank_card(
    req: &RankCardRequest,
    text_renderer: &SharedTextRenderer,
) -> Result<Vec<u8>, ImageGenError> {
    let avatar = fetch_avatar(&req.avatar_url).await?;
    let cw = content_width();
    let card_h = compute_card_height();
    let is_voice = req.is_voice_card.unwrap_or(false);

    let mut canvas = Pixmap::new(CARD_WIDTH, card_h)
        .ok_or_else(|| ImageGenError::Rendering("Failed to create canvas".into()))?;

    canvas.fill(bg_color());
    draw_rect_outline(&mut canvas, 0.0, 0.0, CARD_WIDTH as f32, card_h as f32, border_color(), 1.0);

    let mut y = PAD_Y;

    // ── HEADER ──────────────────────────────────────────────────────────
    // Avatar
    draw_rect_filled(&mut canvas, PAD_X, y, AVATAR_SIZE, AVATAR_SIZE, box_bg());
    draw_rect_outline(&mut canvas, PAD_X, y, AVATAR_SIZE, AVATAR_SIZE, border_color(), 1.0);
    draw_square_avatar(&mut canvas, &avatar, PAD_X, y, AVATAR_SIZE);

    let text_left = PAD_X + AVATAR_SIZE + 16.0;
    let text_area_w = cw - AVATAR_SIZE - 16.0 - 160.0; // leave room for rank badge

    {
        let mut renderer = text_renderer.lock().unwrap();

        // Username — vertically centered in top half of avatar area
        let username = sanitize_text(&req.username);
        let (username_pm, _, uh) = renderer.render_text(
            &username, "JetBrains Mono", 22.0, FontWeight::SemiBold,
            text_primary(), text_area_w,
        )?;
        let username_y = y + (AVATAR_SIZE / 2.0 - uh) / 2.0;
        canvas.draw_pixmap(
            text_left as i32, username_y as i32,
            username_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        // Member since — vertically centered in bottom half of avatar area
        let member_since = req.member_since.as_deref().unwrap_or("Unknown");
        let tag = format!("MEMBER SINCE {}", member_since.to_uppercase());
        let (tag_pm, _, th) = renderer.render_text(
            &tag, "JetBrains Mono", 11.0, FontWeight::Regular,
            text_secondary(), text_area_w,
        )?;
        let tag_y = y + AVATAR_SIZE / 2.0 + (AVATAR_SIZE / 2.0 - th) / 2.0;
        canvas.draw_pixmap(
            text_left as i32, tag_y as i32,
            tag_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        // Rank badge — right-aligned, vertically centered in avatar area
        let rank_text = format!("#{}", req.rank);
        let (rl_pm, rlw, rlh) = renderer.render_text(
            "RANK", "JetBrains Mono", 12.0, FontWeight::Regular,
            text_secondary(), 100.0,
        )?;
        let (rv_pm, rvw, rvh) = renderer.render_text(
            &rank_text, "JetBrains Mono", 22.0, FontWeight::Bold,
            text_primary(), 100.0,
        )?;
        let badge_w = rlw + 8.0 + rvw;
        let badge_x = right_align(PAD_X, cw, badge_w);
        let badge_center_y = y + (AVATAR_SIZE - rvh.max(rlh)) / 2.0;
        // "RANK" label baseline-aligned with value
        canvas.draw_pixmap(
            badge_x as i32, (badge_center_y + (rvh - rlh) / 2.0) as i32,
            rl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
        canvas.draw_pixmap(
            (badge_x + rlw + 8.0) as i32, badge_center_y as i32,
            rv_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
    }

    y += AVATAR_SIZE + HEADER_BOTTOM_GAP;

    // Divider
    draw_hline(&mut canvas, PAD_X, CARD_WIDTH as f32 - PAD_X, y, border_color());
    y += 1.0 + DIVIDER_GAP;

    // ── YOUR STATS ──────────────────────────────────────────────────────
    {
        let mut renderer = text_renderer.lock().unwrap();
        let (lbl_pm, _, _) = renderer.render_text(
            "YOUR STATS", "JetBrains Mono", 11.0, FontWeight::Regular,
            text_secondary(), cw,
        )?;
        canvas.draw_pixmap(
            PAD_X as i32, y as i32,
            lbl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
    }
    y += SECTION_LABEL_H + LABEL_GAP;

    // Stat boxes — 3 equal width
    let box_w = (cw - STAT_BOX_GAP * 2.0) / 3.0;
    let total_xp = req.current_xp + req.level as u64 * req.required_xp;
    let stats = [
        ("LEVEL", format!("{}", req.level)),
        ("TOTAL XP", format_number(total_xp)),
        ("SERVER RANK", format!("#{}", req.rank)),
    ];

    for (i, (label, value)) in stats.iter().enumerate() {
        let bx = PAD_X + (box_w + STAT_BOX_GAP) * i as f32;
        draw_rect_filled(&mut canvas, bx, y, box_w, STAT_BOX_H, box_bg());
        draw_rect_outline(&mut canvas, bx, y, box_w, STAT_BOX_H, border_color(), 1.0);

        let mut renderer = text_renderer.lock().unwrap();

        // Label — left-aligned with inner padding
        let (lbl_pm, _, _) = renderer.render_text(
            label, "JetBrains Mono", 11.0, FontWeight::Regular,
            text_secondary(), box_w - STAT_BOX_PAD * 2.0,
        )?;
        canvas.draw_pixmap(
            (bx + STAT_BOX_PAD) as i32, (y + STAT_BOX_PAD) as i32,
            lbl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        // Value — left-aligned below label
        let value_y = y + STAT_BOX_PAD + 14.0 + 6.0; // label_h + gap
        let (val_pm, _, _) = renderer.render_text(
            value, "JetBrains Mono", 28.0, FontWeight::SemiBold,
            text_primary(), box_w - STAT_BOX_PAD * 2.0,
        )?;
        canvas.draw_pixmap(
            (bx + STAT_BOX_PAD) as i32, value_y as i32,
            val_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
    }
    y += STAT_BOX_H + SECTION_GAP;

    // ── PROGRESS BAR ────────────────────────────────────────────────────
    let progress_pct = if req.required_xp > 0 {
        (req.current_xp as f64 / req.required_xp as f64 * 100.0).min(100.0)
    } else {
        0.0
    };

    {
        let mut renderer = text_renderer.lock().unwrap();

        // "PROGRESS TO LEVEL X" — left-aligned
        let progress_label = format!("PROGRESS TO LEVEL {}", req.level + 1);
        let (pl_pm, _, _) = renderer.render_text(
            &progress_label, "JetBrains Mono", 11.0, FontWeight::Regular,
            text_secondary(), cw,
        )?;
        canvas.draw_pixmap(
            PAD_X as i32, y as i32,
            pl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        // "X / Y XP" — right-aligned on same line
        let xp_text = format!("{} / {} XP", format_number(req.current_xp), format_number(req.required_xp));
        let (xp_pm, xw, _) = renderer.render_text(
            &xp_text, "JetBrains Mono", 12.0, FontWeight::Regular,
            text_secondary(), cw,
        )?;
        canvas.draw_pixmap(
            right_align(PAD_X, cw, xw) as i32, y as i32,
            xp_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
    }
    y += PROGRESS_LABEL_H + PROGRESS_GAP;

    // Bar track
    draw_rect_filled(&mut canvas, PAD_X, y, cw, PROGRESS_BAR_H, box_bg());
    draw_rect_outline(&mut canvas, PAD_X, y, cw, PROGRESS_BAR_H, border_color(), 1.0);

    // Bar fill
    let min_fill = cw * 0.02; // 2% minimum visible width
    let fill_w = (cw * progress_pct as f32 / 100.0).max(min_fill).min(cw);
    draw_rect_filled(&mut canvas, PAD_X, y, fill_w, PROGRESS_BAR_H, accent_green());

    // Percentage text — right-aligned inside bar, vertically centered
    {
        let mut renderer = text_renderer.lock().unwrap();
        let pct_text = format!("{:.1}%", progress_pct);
        let (pct_pm, pw, ph) = renderer.render_text(
            &pct_text, "JetBrains Mono", 11.0, FontWeight::Medium,
            text_primary(), 100.0,
        )?;
        let pct_x = right_align(PAD_X, cw, pw + 12.0);
        let pct_y = y + (PROGRESS_BAR_H - ph) / 2.0;
        canvas.draw_pixmap(
            pct_x as i32, pct_y as i32,
            pct_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
    }
    y += PROGRESS_BAR_H + SECTION_GAP;

    // ── BREAKDOWN PANELS ────────────────────────────────────────────────
    let half_w = (cw - BREAKDOWN_GAP) / 2.0;
    let inner_pad = 20.0;
    let inner_w = half_w - inner_pad * 2.0;

    // --- Left panel: XP Breakdown ---
    let left_x = PAD_X;
    draw_rect_filled(&mut canvas, left_x, y, half_w, BREAKDOWN_H, box_bg());
    draw_rect_outline(&mut canvas, left_x, y, half_w, BREAKDOWN_H, border_color(), 1.0);

    let messages_xp = req.messages_xp.unwrap_or(0);
    let voice_xp = req.voice_xp.unwrap_or(0);
    let reactions_xp = req.reactions_xp.unwrap_or(0);
    let commands_xp = req.commands_xp.unwrap_or(0);
    let total_breakdown = messages_xp + voice_xp + reactions_xp + commands_xp;

    let label1 = if is_voice { "Total Time" } else { "Messages" };
    let label2 = if is_voice { "Streaming" } else { "Voice" };
    let label3 = if is_voice { "Video" } else { "Reactions" };
    let label4 = if is_voice { "Regular" } else { "Commands" };

    {
        let mut renderer = text_renderer.lock().unwrap();

        // Panel title
        let (title_pm, _, _) = renderer.render_text(
            "XP BREAKDOWN", "JetBrains Mono", 10.0, FontWeight::Regular,
            text_secondary(), inner_w,
        )?;
        canvas.draw_pixmap(
            (left_x + inner_pad) as i32, (y + inner_pad) as i32,
            title_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        let bar_data: [(&str, u64, Color); 4] = [
            (label1, messages_xp, bar_messages()),
            (label2, voice_xp, bar_voice()),
            (label3, reactions_xp, bar_reactions()),
            (label4, commands_xp, bar_commands()),
        ];

        let bar_start_y = y + inner_pad + 28.0;
        let bar_spacing = 36.0;
        let label_col_w = 90.0;
        let value_col_w = 50.0;
        let gap_w = 12.0;
        let bar_track_w = inner_w - label_col_w - value_col_w - gap_w * 2.0;

        for (i, (label, xp, bar_color)) in bar_data.iter().enumerate() {
            let by = bar_start_y + i as f32 * bar_spacing;

            // Label — right-aligned in label column
            let (lbl_pm, lw, lh) = renderer.render_text(
                label, "JetBrains Mono", 11.0, FontWeight::Regular,
                text_muted(), label_col_w,
            )?;
            let lbl_x = left_x + inner_pad + label_col_w - lw;
            canvas.draw_pixmap(
                lbl_x as i32, by as i32,
                lbl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );

            // Bar track
            let track_x = left_x + inner_pad + label_col_w + gap_w;
            let bar_h = 12.0;
            let bar_y = by + (lh - bar_h) / 2.0;
            draw_rect_filled(&mut canvas, track_x, bar_y, bar_track_w, bar_h, border_color());

            // Bar fill
            let pct = if total_breakdown > 0 { *xp as f32 / total_breakdown as f32 } else { 0.0 };
            let fill = bar_track_w * pct;
            if fill > 0.0 {
                draw_rect_filled(&mut canvas, track_x, bar_y, fill, bar_h, *bar_color);
            }

            // Value — right-aligned in value column
            let (val_pm, vw, _) = renderer.render_text(
                &format_number(*xp), "JetBrains Mono", 11.0, FontWeight::Regular,
                text_muted(), value_col_w,
            )?;
            let val_x = track_x + bar_track_w + gap_w + value_col_w - vw;
            canvas.draw_pixmap(
                val_x as i32, by as i32,
                val_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
        }
    }

    // --- Right panel: Activity ---
    let right_x = PAD_X + half_w + BREAKDOWN_GAP;
    draw_rect_filled(&mut canvas, right_x, y, half_w, BREAKDOWN_H, box_bg());
    draw_rect_outline(&mut canvas, right_x, y, half_w, BREAKDOWN_H, border_color(), 1.0);

    {
        let mut renderer = text_renderer.lock().unwrap();

        let (title_pm, _, _) = renderer.render_text(
            "ACTIVITY", "JetBrains Mono", 10.0, FontWeight::Regular,
            text_secondary(), inner_w,
        )?;
        canvas.draw_pixmap(
            (right_x + inner_pad) as i32, (y + inner_pad) as i32,
            title_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        let last7_label = if is_voice { "LAST 7 DAYS (MIN)" } else { "LAST 7 DAYS" };
        let last30_label = if is_voice { "LAST 30 DAYS (MIN)" } else { "LAST 30 DAYS" };

        let channel_name = sanitize_text(req.most_active_channel.as_deref().unwrap_or("N/A"));
        let activity_rows = [
            ("MOST ACTIVE IN", channel_name),
            (last7_label, format!("+{}", format_number(req.last_7_days_xp.unwrap_or(0)))),
            (last30_label, format!("+{}", format_number(req.last_30_days_xp.unwrap_or(0)))),
            ("STREAK", format!("{} days", req.streak.unwrap_or(0))),
        ];

        let row_start_y = y + inner_pad + 28.0;
        let row_spacing = 36.0;

        for (i, (label, value)) in activity_rows.iter().enumerate() {
            let ry = row_start_y + i as f32 * row_spacing;

            // Label — left-aligned
            let (lbl_pm, _, _) = renderer.render_text(
                label, "JetBrains Mono", 11.0, FontWeight::Regular,
                text_secondary(), inner_w,
            )?;
            canvas.draw_pixmap(
                (right_x + inner_pad) as i32, ry as i32,
                lbl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );

            // Value — right-aligned
            let (val_pm, vw, _) = renderer.render_text(
                value, "JetBrains Mono", 12.0, FontWeight::Regular,
                text_primary(), inner_w,
            )?;
            canvas.draw_pixmap(
                right_align(right_x + inner_pad, inner_w, vw) as i32, ry as i32,
                val_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );

            // Divider between rows (not after last)
            if i < activity_rows.len() - 1 {
                draw_hline(
                    &mut canvas,
                    right_x + inner_pad,
                    right_x + half_w - inner_pad,
                    ry + 24.0,
                    border_color(),
                );
            }
        }
    }

    // Encode
    let png_data = canvas.encode_png()
        .map_err(|e| ImageGenError::Rendering(format!("PNG encode error: {e}")))?;

    Ok(png_data)
}
