/**
 * Design System Tokens for Discord UI
 *
 * Centralized design tokens for consistent UI across all bot modules.
 * This file defines colors, emojis, spacing, and other design primitives.
 */

import { SeparatorSpacingSize } from 'discord.js';

// Spacing

/**
 * Separator spacing sizes for Components V2
 */
export const SPACING = {
  SMALL: SeparatorSpacingSize.Small,
  LARGE: SeparatorSpacingSize.Large,
} as const;

export { ERROR_ICONS, type ErrorType } from './errors.js';

export { COLORS } from './colors.js';

export { EMOJI as EMOJI } from './emojis.js';
