/// Embedded bonk assets (PNGs)
pub mod bonk {
    pub const DOGE_SOURCE: &[u8] = include_bytes!("../assets/bonk/doge_bonk_source.png");
    pub const CAT_SOURCE: &[u8] = include_bytes!("../assets/bonk/cat_bonk_source.png");
    pub const LIONS_SOURCE: &[u8] = include_bytes!("../assets/bonk/lions_bonk_source.png");
    pub const RABBIT_SOURCE: &[u8] = include_bytes!("../assets/bonk/rabbit_bonk_source.png");
    pub const DOGE_FATALITY_SOURCE: &[u8] = include_bytes!("../assets/bonk/doge_bonk_fatality.png");
    pub const CAPY_SOURCE: &[u8] = include_bytes!("../assets/bonk/capy_bonk_source.png");
    pub const BAT_OVERLAY: &[u8] = include_bytes!("../assets/bonk/bonk_bat.png");
}

/// Embedded fonts
pub mod fonts {
    pub const ANTON_REGULAR: &[u8] = include_bytes!("../assets/fonts/Anton-Regular.ttf");
    pub const JETBRAINS_MONO_REGULAR: &[u8] =
        include_bytes!("../assets/fonts/JetBrainsMono-Regular.ttf");
    pub const JETBRAINS_MONO_MEDIUM: &[u8] =
        include_bytes!("../assets/fonts/JetBrainsMono-Medium.ttf");
    pub const JETBRAINS_MONO_SEMIBOLD: &[u8] =
        include_bytes!("../assets/fonts/JetBrainsMono-SemiBold.ttf");
    pub const JETBRAINS_MONO_BOLD: &[u8] =
        include_bytes!("../assets/fonts/JetBrainsMono-Bold.ttf");
}
