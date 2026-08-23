// Colors

/**
 * Semantic color palette for embeds and UI elements
 *
 * Colors are stored as numbers (hex integers) which are compatible with both
 * EmbedBuilder.setColor() and ContainerBuilder.setAccentColor()
 */
export const COLORS = {
  SUCCESS: 0x57f287,
  ERROR: 0xed4245,
  WARNING: 0xfee75c,
  INFO: 0x5865f2,
  NEUTRAL: 0x99aab5,

  PRIMARY: 0x5865f2,
  MOD_PANEL: 0x5865f2,

  BAN: 0xed4245,
  KICK: 0xf57c00,
  TIMEOUT: 0xfee75c,
  WARN: 0xffc107,
  MUTE: 0x607d8b,
  UNMUTE: 0x9e9e9e,
} as const;
