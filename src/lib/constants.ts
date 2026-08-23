import { type ColorResolvable } from 'discord.js';

export const COLORS = {
  SUCCESS: '#00FF00' as ColorResolvable,
  ERROR: '#FF0000' as ColorResolvable,
  INFO: '#0099FF' as ColorResolvable,
  WARNING: '#FFFF00' as ColorResolvable,
  DEFAULT: '#5865F2' as ColorResolvable,
} as const;

export const MESSAGES = {
  NO_PERMISSION: 'You do not have permission to use this command.',
  GUILD_ONLY: 'This command can only be used in a server.',
  OWNER_ONLY: 'This command can only be used by the bot owner.',
  COOLDOWN: 'Please wait before using this command again.',
  GENERIC_ERROR: 'An error occurred while executing this command.',
} as const;
