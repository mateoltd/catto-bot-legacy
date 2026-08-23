use crate::avatar::{draw_square_avatar, fetch_avatar};
use crate::error::ImageGenError;
use crate::text::{FontWeight, SharedTextRenderer};
use super::common::{center_in, draw_dot, draw_hline, draw_rect_filled, draw_rect_outline, format_number, right_align, sanitize_text, truncate_username};
use serde::Deserialize;
use tiny_skia::{Color, Pixmap, PixmapPaint, Transform};

const CARD_WIDTH: u32 = 700;

// Padding
const PAD: f32 = 32.0;

// Section dimensions
const HEADER_TITLE_H: f32 = 32.0;
const HEADER_SUB_H: f32 = 20.0;
const STAT_BOX_H: f32 = 56.0;
const STAT_BOX_GAP: f32 = 12.0;
const STAT_BOX_PAD: f32 = 16.0;
const COLUMN_HEADER_H: f32 = 24.0;
const ENTRY_H: f32 = 52.0;
const ENTRY_GAP: f32 = 2.0;
const SECTION_GAP: f32 = 16.0;
const AVATAR_SIZE: f32 = 36.0;
const DIST_ROW_H: f32 = 20.0;

// Theme colors (GitHub dark)
fn bg_color() -> Color { Color::from_rgba8(13, 17, 23, 255) }
fn border_color() -> Color { Color::from_rgba8(33, 38, 45, 255) }
fn text_primary() -> Color { Color::from_rgba8(201, 209, 217, 255) }
fn text_secondary() -> Color { Color::from_rgba8(110, 118, 129, 255) }
fn text_muted() -> Color { Color::from_rgba8(155, 164, 174, 255) }
fn box_bg() -> Color { Color::from_rgba8(22, 27, 34, 255) }
fn xp_color() -> Color { Color::from_rgba8(124, 152, 133, 255) }
fn rank1_color() -> Color { Color::from_rgba8(124, 152, 133, 255) }
fn rank2_color() -> Color { Color::from_rgba8(139, 148, 158, 255) }
fn rank3_color() -> Color { Color::from_rgba8(110, 92, 59, 255) }

fn content_width() -> f32 {
    CARD_WIDTH as f32 - PAD * 2.0
}

fn compute_card_height(entry_count: usize, has_distribution: bool) -> u32 {
    let mut h = PAD;
    h += HEADER_TITLE_H + HEADER_SUB_H;       // title + subtitle
    h += 1.0 + SECTION_GAP;                   // divider + gap
    h += STAT_BOX_H + SECTION_GAP;            // stat boxes
    h += COLUMN_HEADER_H;                     // column headers
    h += entry_count as f32 * (ENTRY_H + ENTRY_GAP); // entries
    h += SECTION_GAP;
    if has_distribution {
        h += 1.0 + SECTION_GAP;               // divider + gap
        h += 16.0;                             // "XP DISTRIBUTION" label
        h += DIST_ROW_H * 3.0 + 8.0;          // 3 bar rows + padding
    }
    h += PAD;
    h.ceil() as u32
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardRequest {
    pub guild_name: String,
    #[serde(default)]
    pub guild_icon: Option<String>,
    pub entries: Vec<LeaderboardEntry>,
    #[serde(default)]
    pub accent_color: Option<String>,
    #[serde(default)]
    pub total_members: Option<u32>,
    #[serde(default, alias = "totalXp")]
    pub total_xp: Option<u64>,
    #[serde(default, alias = "weeklyXp")]
    pub weekly_xp: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub username: String,
    pub avatar_url: String,
    pub level: u32,
    pub xp: u64,
}

pub async fn render_leaderboard(
    req: &LeaderboardRequest,
    text_renderer: &SharedTextRenderer,
) -> Result<Vec<u8>, ImageGenError> {
    let entry_count = req.entries.len();
    let has_dist = entry_count >= 3;
    let card_h = compute_card_height(entry_count, has_dist);
    let cw = content_width();

    // Fetch all avatars in parallel
    let avatar_futures: Vec<_> = req.entries.iter()
        .map(|entry| fetch_avatar(&entry.avatar_url))
        .collect();
    let avatars: Vec<Result<Pixmap, ImageGenError>> = futures::future::join_all(avatar_futures).await;

    let mut canvas = Pixmap::new(CARD_WIDTH, card_h)
        .ok_or_else(|| ImageGenError::Rendering("Failed to create canvas".into()))?;

    canvas.fill(bg_color());
    draw_rect_outline(&mut canvas, 0.0, 0.0, CARD_WIDTH as f32, card_h as f32, border_color(), 1.0);

    let mut y = PAD;

    // ── HEADER ──────────────────────────────────────────────────────────
    {
        let mut renderer = text_renderer.lock().unwrap();

        let guild_name = sanitize_text(&req.guild_name);
        let (title_pm, _, _) = renderer.render_text(
            &guild_name, "JetBrains Mono", 24.0, FontWeight::Bold,
            text_primary(), cw,
        )?;
        canvas.draw_pixmap(
            PAD as i32, y as i32,
            title_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
        y += HEADER_TITLE_H;

        // "XP LEADERBOARD  ·  TOP N" with a drawn dot separator
        let left_part = "XP LEADERBOARD";
        let right_part = format!("TOP {}", entry_count);
        let (left_pm, lw, lh) = renderer.render_text(
            left_part, "JetBrains Mono", 11.0, FontWeight::Medium,
            text_secondary(), cw,
        )?;
        let (right_pm, _, _) = renderer.render_text(
            &right_part, "JetBrains Mono", 11.0, FontWeight::Medium,
            text_secondary(), cw,
        )?;
        canvas.draw_pixmap(
            PAD as i32, y as i32,
            left_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
        let dot_gap = 8.0;
        let dot_x = PAD + lw + dot_gap;
        let dot_y = y + lh / 2.0;
        draw_dot(&mut canvas, dot_x, dot_y, 2.0, text_secondary());
        let right_x = dot_x + dot_gap;
        canvas.draw_pixmap(
            right_x as i32, y as i32,
            right_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
        y += HEADER_SUB_H;
    }

    draw_hline(&mut canvas, PAD, CARD_WIDTH as f32 - PAD, y, border_color());
    y += 1.0 + SECTION_GAP;

    // ── STATS BOXES ─────────────────────────────────────────────────────
    let total_members = req.total_members.unwrap_or(entry_count as u32);
    let total_xp = req.total_xp.unwrap_or_else(|| req.entries.iter().map(|e| e.xp).sum());
    let weekly_xp = req.weekly_xp.unwrap_or(0);

    let stats = [
        ("TOTAL MEMBERS", format_number(total_members as u64)),
        ("TOTAL XP", format_number(total_xp)),
        ("THIS WEEK", format_number(weekly_xp)),
    ];

    let box_w = (cw - STAT_BOX_GAP * 2.0) / 3.0;

    {
        let mut renderer = text_renderer.lock().unwrap();
        for (i, (label, value)) in stats.iter().enumerate() {
            let bx = PAD + (box_w + STAT_BOX_GAP) * i as f32;
            draw_rect_filled(&mut canvas, bx, y, box_w, STAT_BOX_H, box_bg());
            draw_rect_outline(&mut canvas, bx, y, box_w, STAT_BOX_H, border_color(), 1.0);

            let inner_w = box_w - STAT_BOX_PAD * 2.0;

            // Label — compute vertical position from box top
            let (lbl_pm, _, lbl_h) = renderer.render_text(
                label, "JetBrains Mono", 10.0, FontWeight::Regular,
                text_secondary(), inner_w,
            )?;
            let (val_pm, _, val_h) = renderer.render_text(
                value, "JetBrains Mono", 20.0, FontWeight::Bold,
                text_primary(), inner_w,
            )?;

            // Vertically center both lines as a group within the box
            let content_h = lbl_h + 4.0 + val_h; // label + gap + value
            let top_offset = (STAT_BOX_H - content_h) / 2.0;

            canvas.draw_pixmap(
                (bx + STAT_BOX_PAD) as i32, (y + top_offset) as i32,
                lbl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
            canvas.draw_pixmap(
                (bx + STAT_BOX_PAD) as i32, (y + top_offset + lbl_h + 4.0) as i32,
                val_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
        }
    }
    y += STAT_BOX_H + SECTION_GAP;

    // ── COLUMN HEADERS ──────────────────────────────────────────────────
    // Grid layout: [inner_pad] rank | avatar | username ... xp | level [inner_pad]
    let entry_inner_pad = 16.0; // inner padding within each entry row
    let entry_left = PAD + entry_inner_pad;
    let entry_right = PAD + cw - entry_inner_pad;

    let rank_col_x = entry_left;
    let rank_col_w = 36.0;
    let avatar_col_x = entry_left + rank_col_w + 8.0;
    let username_col_x = avatar_col_x + AVATAR_SIZE + 12.0;
    let level_col_w = 50.0;
    let xp_col_w = 80.0;
    let col_gap = 12.0;
    let level_col_right = entry_right;
    let xp_col_right = level_col_right - level_col_w - col_gap;

    {
        let mut renderer = text_renderer.lock().unwrap();

        let (rank_hdr, _, _) = renderer.render_text(
            "RANK", "JetBrains Mono", 10.0, FontWeight::Regular,
            text_secondary(), rank_col_w,
        )?;
        canvas.draw_pixmap(
            rank_col_x as i32, y as i32,
            rank_hdr.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        let (user_hdr, _, _) = renderer.render_text(
            "USER", "JetBrains Mono", 10.0, FontWeight::Regular,
            text_secondary(), 200.0,
        )?;
        canvas.draw_pixmap(
            username_col_x as i32, y as i32,
            user_hdr.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        let (xp_hdr, xhw, _) = renderer.render_text(
            "XP", "JetBrains Mono", 10.0, FontWeight::Regular,
            text_secondary(), xp_col_w,
        )?;
        canvas.draw_pixmap(
            (xp_col_right - xhw) as i32, y as i32,
            xp_hdr.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );

        let (lvl_hdr, lhw, _) = renderer.render_text(
            "LEVEL", "JetBrains Mono", 10.0, FontWeight::Regular,
            text_secondary(), level_col_w,
        )?;
        canvas.draw_pixmap(
            (level_col_right - lhw) as i32, y as i32,
            lvl_hdr.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
        );
    }
    y += COLUMN_HEADER_H;

    // ── ENTRIES ─────────────────────────────────────────────────────────
    for (i, entry) in req.entries.iter().enumerate() {
        let ey = y + i as f32 * (ENTRY_H + ENTRY_GAP);
        let (rank_color, left_border) = match entry.rank {
            1 => (rank1_color(), Some(rank1_color())),
            2 => (rank2_color(), Some(rank2_color())),
            3 => (rank3_color(), Some(rank3_color())),
            _ => (text_secondary(), None),
        };

        // Entry background
        draw_rect_filled(&mut canvas, PAD, ey, cw, ENTRY_H, box_bg());
        draw_rect_outline(&mut canvas, PAD, ey, cw, ENTRY_H, border_color(), 1.0);

        // Left border accent for top 3
        if let Some(bc) = left_border {
            draw_rect_filled(&mut canvas, PAD, ey, 2.0, ENTRY_H, bc);
        }

        {
            let mut renderer = text_renderer.lock().unwrap();

            // Rank — centered in rank column area
            let rank_text = format!("#{}", entry.rank);
            let (rank_pm, rw, rh) = renderer.render_text(
                &rank_text, "JetBrains Mono", 14.0, FontWeight::SemiBold,
                rank_color, 50.0,
            )?;
            let rank_x = center_in(rank_col_x, rank_col_w, rw);
            let rank_y = ey + (ENTRY_H - rh) / 2.0;
            canvas.draw_pixmap(
                rank_x as i32, rank_y as i32,
                rank_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );

            // Avatar — vertically centered
            let avatar_y = ey + (ENTRY_H - AVATAR_SIZE) / 2.0;
            draw_rect_filled(&mut canvas, avatar_col_x, avatar_y, AVATAR_SIZE, AVATAR_SIZE, bg_color());
            draw_rect_outline(&mut canvas, avatar_col_x, avatar_y, AVATAR_SIZE, AVATAR_SIZE, border_color(), 1.0);
            if let Some(Ok(ref av)) = avatars.get(i) {
                draw_square_avatar(&mut canvas, av, avatar_col_x, avatar_y, AVATAR_SIZE);
            }

            // Username — sanitize then UTF-8 safe truncation
            let clean_name = sanitize_text(&entry.username);
            let display_name = truncate_username(&clean_name, 18, 15);
            let username_max_w = xp_col_right - xp_col_w - col_gap - username_col_x;
            let (name_pm, _, nh) = renderer.render_text(
                &display_name, "JetBrains Mono", 14.0, FontWeight::SemiBold,
                text_primary(), username_max_w,
            )?;
            let xp_sub = format!("{} XP", format_number(entry.xp));
            let (xpsub_pm, _, sh) = renderer.render_text(
                &xp_sub, "JetBrains Mono", 11.0, FontWeight::Regular,
                text_secondary(), username_max_w,
            )?;
            let name_gap = 2.0; // tight gap between name and sub-text
            let name_block_h = nh + name_gap + sh;
            let name_top = ey + (ENTRY_H - name_block_h) / 2.0;
            canvas.draw_pixmap(
                username_col_x as i32, name_top as i32,
                name_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
            canvas.draw_pixmap(
                username_col_x as i32, (name_top + nh + name_gap) as i32,
                xpsub_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );

            // XP value + label as a tight block, vertically centered
            let xp_val = format_number(entry.xp);
            let (xpv_pm, xvw, xvh) = renderer.render_text(
                &xp_val, "JetBrains Mono", 14.0, FontWeight::SemiBold,
                xp_color(), xp_col_w,
            )?;
            let (xpl_pm, xlw, xlh) = renderer.render_text(
                "XP", "JetBrains Mono", 10.0, FontWeight::Regular,
                text_secondary(), 40.0,
            )?;
            let xp_gap = 1.0; // flush: label sits tight under value
            let xp_block_h = xvh + xp_gap + xlh;
            let xp_top = ey + (ENTRY_H - xp_block_h) / 2.0;
            canvas.draw_pixmap(
                (xp_col_right - xvw) as i32, xp_top as i32,
                xpv_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
            canvas.draw_pixmap(
                (xp_col_right - xlw) as i32, (xp_top + xvh + xp_gap) as i32,
                xpl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );

            // Level value + label as a tight block, vertically centered
            let level_val = format!("{}", entry.level);
            let (lvv_pm, lvw, lvh) = renderer.render_text(
                &level_val, "JetBrains Mono", 14.0, FontWeight::Bold,
                text_primary(), level_col_w,
            )?;
            let (lvl_pm, llw, llh) = renderer.render_text(
                "LEVEL", "JetBrains Mono", 10.0, FontWeight::Regular,
                text_secondary(), level_col_w,
            )?;
            let lvl_gap = 1.0;
            let lvl_block_h = lvh + lvl_gap + llh;
            let lvl_top = ey + (ENTRY_H - lvl_block_h) / 2.0;
            canvas.draw_pixmap(
                (level_col_right - lvw) as i32, lvl_top as i32,
                lvv_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
            canvas.draw_pixmap(
                (level_col_right - llw) as i32, (lvl_top + lvh + lvl_gap) as i32,
                lvl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
        }
    }

    y += entry_count as f32 * (ENTRY_H + ENTRY_GAP) + SECTION_GAP;

    // ── XP DISTRIBUTION ─────────────────────────────────────────────────
    if has_dist {
        draw_hline(&mut canvas, PAD, CARD_WIDTH as f32 - PAD, y, border_color());
        y += 1.0 + SECTION_GAP;

        let top_xp = req.entries[0].xp;
        let second_xp = req.entries.get(1).map(|e| e.xp).unwrap_or(0);
        let third_xp = req.entries.get(2).map(|e| e.xp).unwrap_or(0);

        let second_pct = if top_xp > 0 { second_xp as f32 / top_xp as f32 } else { 0.0 };
        let third_pct = if top_xp > 0 { third_xp as f32 / top_xp as f32 } else { 0.0 };

        {
            let mut renderer = text_renderer.lock().unwrap();

            let (dist_pm, _, _) = renderer.render_text(
                "XP DISTRIBUTION", "JetBrains Mono", 10.0, FontWeight::Regular,
                text_secondary(), cw,
            )?;
            canvas.draw_pixmap(
                PAD as i32, y as i32,
                dist_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
            );
            y += 16.0;

            let bar_rows = [
                ("#1", 1.0_f32, format_number(top_xp)),
                ("#2", second_pct, format_number(second_xp)),
                ("#3", third_pct, format_number(third_xp)),
            ];
            let label_w = 40.0;
            let value_w = 60.0;
            let gap = 12.0;
            let bar_track_w = cw - label_w - value_w - gap * 2.0;

            for (label, pct, value) in &bar_rows {
                // Label — right-aligned in label column
                let (lbl_pm, lw, lh) = renderer.render_text(
                    label, "JetBrains Mono", 11.0, FontWeight::Regular,
                    text_muted(), label_w,
                )?;
                canvas.draw_pixmap(
                    (PAD + label_w - lw) as i32, y as i32,
                    lbl_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
                );

                // Bar track
                let track_x = PAD + label_w + gap;
                let bar_h = 8.0;
                let bar_y = y + (lh - bar_h) / 2.0;
                draw_rect_filled(&mut canvas, track_x, bar_y, bar_track_w, bar_h, border_color());
                let fill_w = bar_track_w * pct;
                if fill_w > 0.0 {
                    let bar_color = if *label == "#1" { xp_color() } else { text_secondary() };
                    draw_rect_filled(&mut canvas, track_x, bar_y, fill_w, bar_h, bar_color);
                }

                // Value — right-aligned in value column
                let (val_pm, vw, _) = renderer.render_text(
                    value, "JetBrains Mono", 11.0, FontWeight::Regular,
                    text_muted(), value_w,
                )?;
                canvas.draw_pixmap(
                    right_align(track_x + bar_track_w + gap, value_w, vw) as i32, y as i32,
                    val_pm.as_ref(), &PixmapPaint::default(), Transform::identity(), None,
                );

                y += DIST_ROW_H;
            }
        }
    }

    let png_data = canvas.encode_png()
        .map_err(|e| ImageGenError::Rendering(format!("PNG encode error: {e}")))?;

    Ok(png_data)
}
