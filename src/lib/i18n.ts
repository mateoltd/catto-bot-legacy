import { resolveKey } from '@sapphire/plugin-i18next';
import type { Interaction, Message } from 'discord.js';
import { getGuild } from './database.js';

/**
 * Get the language for a guild from the database
 */
export async function getGuildLanguage(guildId: string): Promise<string> {
  try {
    const guild = await getGuild(guildId);
    return guild?.language || 'en-US';
  } catch {
    return 'en-US';
  }
}

/**
 * Available languages in the bot
 */
export const AVAILABLE_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
] as const;

/**
 * Get language name from code
 */
export function getLanguageName(code: string): string {
  const lang = AVAILABLE_LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.flag} ${lang.name}` : code;
}

/**
 * Check if a language code is valid
 */
export function isValidLanguage(code: string): boolean {
  return AVAILABLE_LANGUAGES.some((l) => l.code === code);
}

/**
 * Resolve a translation key for an interaction
 */
export async function resolveKeyForInteraction(
  interaction: Interaction,
  key: string,
  values?: Record<string, unknown>
) {
  return await resolveKey(interaction, key, values);
}

/**
 * Resolve a translation key for a message
 */
export async function resolveKeyForMessage(
  message: Message,
  key: string,
  values?: Record<string, unknown>
) {
  return await resolveKey(message, key, values);
}
