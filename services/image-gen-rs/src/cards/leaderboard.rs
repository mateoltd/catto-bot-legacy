use super::common::{draw_dot, draw_rounded_rect_filled, fit_single_line, sanitize_text};
use crate::avatar::{draw_circular_avatar, fetch_avatar};
use crate::error::ImageGenError;
use crate::text::{FontWeight, SharedTextRenderer, TextRenderer};
use serde::Deserialize;
use tiny_skia::{Color, Pixmap, PixmapPaint, Transform};

const CARD_WIDTH: u32 = 600;
const HEADER_END: f32 = 98.0;
const SUMMARY_HEIGHT: f32 = 136.0;
const RANKING_Y: f32 = 248.0;
const RANKING_PADDING: f32 = 18.0;
const COLUMNS_HEIGHT: f32 = 37.0;
const ROW_HEIGHT: f32 = 68.0;
const ROW_GAP: f32 = 5.0;

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
fn white_muted() -> Color {
    Color::from_rgba8(221, 208, 249, 255)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardRequest {
    pub guild_name: String,
    pub entries: Vec<LeaderboardEntry>,
    pub total_members: u32,
    #[serde(alias = "totalXp")]
    pub total_xp: u64,
    #[serde(alias = "weeklyXp")]
    pub weekly_xp: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub username: String,
    pub avatar_url: Option<String>,
    pub level: u32,
    pub xp: u64,
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

fn card_height(entry_count: usize) -> u32 {
    let rows_height = if entry_count == 0 {
        0.0
    } else {
        entry_count as f32 * ROW_HEIGHT + (entry_count - 1) as f32 * ROW_GAP
    };
    (RANKING_Y + RANKING_PADDING * 2.0 + COLUMNS_HEIGHT + rows_height + 20.0).ceil() as u32
}

fn initials(name: &str) -> String {
    let clean = sanitize_text(name);
    let mut chars = clean
        .chars()
        .filter(|character| character.is_alphanumeric());
    let first = chars.next().unwrap_or('?');
    let second = chars.next().unwrap_or(first);
    format!("{first}{second}").to_uppercase()
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
pub async fn render_leaderboard(
    req: &LeaderboardRequest,
    text_renderer: &SharedTextRenderer,
) -> Result<Vec<u8>, ImageGenError> {
    let SURFACE = surface();
    let WHITE = white();
    let INK = ink();
    let MUTED = muted();
    let PURPLE = purple();
    let LAVENDER = lavender();
    let WHITE_MUTED = white_muted();

    let avatar_futures = req.entries.iter().map(|entry| async {
        match &entry.avatar_url {
            Some(url) => fetch_avatar(url).await.ok(),
            None => None,
        }
    });
    let avatars = futures::future::join_all(avatar_futures).await;

    let height = card_height(req.entries.len());
    let mut canvas = Pixmap::new(CARD_WIDTH, height)
        .ok_or_else(|| ImageGenError::Rendering("Failed to create canvas".into()))?;

    draw_rounded_rect_filled(
        &mut canvas,
        0.0,
        0.0,
        CARD_WIDTH as f32,
        height as f32,
        32.0,
        SURFACE,
    );
    draw_rounded_rect_filled(
        &mut canvas,
        20.0,
        HEADER_END,
        386.0,
        SUMMARY_HEIGHT,
        24.0,
        WHITE,
    );
    draw_rounded_rect_filled(
        &mut canvas,
        420.0,
        HEADER_END,
        160.0,
        SUMMARY_HEIGHT,
        24.0,
        PURPLE,
    );

    let ranking_height = height as f32 - RANKING_Y - 20.0;
    draw_rounded_rect_filled(
        &mut canvas,
        20.0,
        RANKING_Y,
        560.0,
        ranking_height,
        24.0,
        WHITE,
    );

    let total_members = req.total_members;
    let total_xp = req.total_xp;
    let weekly_xp = req.weekly_xp;
    let highest_xp = req.entries.iter().map(|entry| entry.xp).max().unwrap_or(0);

    {
        let mut renderer = text_renderer.lock().unwrap();
        let guild_name = sanitize_text(&req.guild_name);
        if guild_name.is_empty() {
            return Err(ImageGenError::Rendering(
                "Leaderboard guild name must not be empty".into(),
            ));
        }
        let (guild_name, guild_name_size) = fit_single_line(
            &mut renderer,
            &guild_name,
            350.0,
            21.0,
            14.0,
            FontWeight::Medium,
        );

        draw_text(
            &mut canvas,
            &mut renderer,
            &guild_name,
            28.0,
            28.0,
            350.0,
            guild_name_size,
            FontWeight::Medium,
            INK,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            "XP leaderboard",
            28.0,
            57.0,
            250.0,
            15.0,
            FontWeight::Regular,
            MUTED,
        )?;
        let members_text = comma_number(total_members as u64);
        let (members_text, members_size) = fit_single_line(
            &mut renderer,
            &members_text,
            130.0,
            22.0,
            14.0,
            FontWeight::Medium,
        );
        draw_text_right(
            &mut canvas,
            &mut renderer,
            &members_text,
            572.0,
            28.0,
            130.0,
            members_size,
            FontWeight::Medium,
            PURPLE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "Members",
            572.0,
            59.0,
            110.0,
            15.0,
            FontWeight::Regular,
            PURPLE,
        )?;

        let total_text = comma_number(total_xp);
        let (total_text, total_size) = fit_single_line(
            &mut renderer,
            &total_text,
            190.0,
            52.0,
            24.0,
            FontWeight::Regular,
        );
        draw_text(
            &mut canvas,
            &mut renderer,
            &total_text,
            44.0,
            117.0,
            190.0,
            total_size,
            FontWeight::Regular,
            INK,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            "Total XP",
            44.0,
            194.0,
            120.0,
            15.0,
            FontWeight::Medium,
            INK,
        )?;
        let highest_text = comma_number(highest_xp);
        let (highest_text, highest_size) = fit_single_line(
            &mut renderer,
            &highest_text,
            110.0,
            18.0,
            12.0,
            FontWeight::Medium,
        );
        draw_text_right(
            &mut canvas,
            &mut renderer,
            &highest_text,
            382.0,
            128.0,
            110.0,
            highest_size,
            FontWeight::Medium,
            PURPLE,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "Highest XP",
            382.0,
            194.0,
            110.0,
            15.0,
            FontWeight::Regular,
            PURPLE,
        )?;

        let weekly_text = comma_number(weekly_xp);
        let (weekly_text, weekly_size) = fit_single_line(
            &mut renderer,
            &weekly_text,
            112.0,
            28.0,
            15.0,
            FontWeight::Regular,
        );
        draw_text(
            &mut canvas,
            &mut renderer,
            &weekly_text,
            444.0,
            123.0,
            112.0,
            weekly_size,
            FontWeight::Regular,
            WHITE,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            "This week",
            444.0,
            194.0,
            112.0,
            15.0,
            FontWeight::Regular,
            WHITE,
        )?;

        let header_y = RANKING_Y + RANKING_PADDING + 5.0;
        draw_text(
            &mut canvas,
            &mut renderer,
            "Rank",
            52.0,
            header_y,
            56.0,
            14.0,
            FontWeight::Regular,
            MUTED,
        )?;
        draw_text(
            &mut canvas,
            &mut renderer,
            "Member",
            120.0,
            header_y,
            200.0,
            14.0,
            FontWeight::Regular,
            MUTED,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "XP",
            472.0,
            header_y,
            96.0,
            14.0,
            FontWeight::Regular,
            MUTED,
        )?;
        draw_text_right(
            &mut canvas,
            &mut renderer,
            "Level",
            548.0,
            header_y,
            64.0,
            14.0,
            FontWeight::Regular,
            MUTED,
        )?;

        let rows_y = RANKING_Y + RANKING_PADDING + COLUMNS_HEIGHT;
        for (index, entry) in req.entries.iter().enumerate() {
            let row_y = rows_y + index as f32 * (ROW_HEIGHT + ROW_GAP);
            let (row_color, text_color, secondary_color, avatar_color, avatar_text_color) =
                match index {
                    0 => (PURPLE, WHITE, WHITE_MUTED, WHITE, PURPLE),
                    1 => (LAVENDER, INK, MUTED, WHITE, PURPLE),
                    2 => (SURFACE, INK, MUTED, LAVENDER, PURPLE),
                    _ => (WHITE, INK, MUTED, LAVENDER, PURPLE),
                };

            draw_rounded_rect_filled(&mut canvas, 38.0, row_y, 524.0, ROW_HEIGHT, 16.0, row_color);

            let center_y = row_y + ROW_HEIGHT / 2.0;
            draw_dot(&mut canvas, 140.0, center_y, 20.0, avatar_color);
            if let Some(avatar) = &avatars[index] {
                draw_circular_avatar(
                    &mut canvas,
                    avatar,
                    140.0,
                    center_y,
                    40.0,
                    0.0,
                    avatar_color,
                );
            } else {
                let avatar_initials = initials(&entry.username);
                let initials_width =
                    renderer.measure_text(&avatar_initials, "DM Sans", 13.0, FontWeight::Medium);
                draw_text(
                    &mut canvas,
                    &mut renderer,
                    &avatar_initials,
                    140.0 - initials_width / 2.0,
                    row_y + 26.0,
                    36.0,
                    13.0,
                    FontWeight::Medium,
                    avatar_text_color,
                )?;
            }

            let rank_text = format!("{:02}", entry.rank);
            let (rank_text, rank_size) = fit_single_line(
                &mut renderer,
                &rank_text,
                56.0,
                16.0,
                12.0,
                FontWeight::Medium,
            );
            draw_text(
                &mut canvas,
                &mut renderer,
                &rank_text,
                52.0,
                row_y + 24.0,
                56.0,
                rank_size,
                FontWeight::Medium,
                text_color,
            )?;

            let username = sanitize_text(&entry.username);
            if username.is_empty() {
                return Err(ImageGenError::Rendering(format!(
                    "Leaderboard entry {} has an empty username",
                    entry.rank
                )));
            }
            let (username, username_size) = fit_single_line(
                &mut renderer,
                &username,
                185.0,
                17.0,
                12.0,
                FontWeight::Medium,
            );
            draw_text(
                &mut canvas,
                &mut renderer,
                &username,
                173.0,
                row_y + 12.0,
                185.0,
                username_size,
                FontWeight::Medium,
                text_color,
            )?;
            let member_note = if index == 0 {
                "Top member".to_string()
            } else {
                format!("{} XP", comma_number(entry.xp))
            };
            let (member_note, member_note_size) = fit_single_line(
                &mut renderer,
                &member_note,
                185.0,
                13.0,
                11.0,
                FontWeight::Regular,
            );
            draw_text(
                &mut canvas,
                &mut renderer,
                &member_note,
                173.0,
                row_y + 38.0,
                185.0,
                member_note_size,
                FontWeight::Regular,
                secondary_color,
            )?;
            let xp_text = comma_number(entry.xp);
            let (xp_text, xp_size) = fit_single_line(
                &mut renderer,
                &xp_text,
                96.0,
                16.0,
                11.0,
                FontWeight::Medium,
            );
            draw_text_right(
                &mut canvas,
                &mut renderer,
                &xp_text,
                472.0,
                row_y + 23.0,
                96.0,
                xp_size,
                FontWeight::Medium,
                text_color,
            )?;
            let level_text = entry.level.to_string();
            let (level_text, level_size) = fit_single_line(
                &mut renderer,
                &level_text,
                64.0,
                16.0,
                11.0,
                FontWeight::Medium,
            );
            draw_text_right(
                &mut canvas,
                &mut renderer,
                &level_text,
                548.0,
                row_y + 23.0,
                64.0,
                level_size,
                FontWeight::Medium,
                text_color,
            )?;
        }
    }

    canvas
        .encode_png()
        .map_err(|error| ImageGenError::Rendering(format!("PNG encode error: {error}")))
}
