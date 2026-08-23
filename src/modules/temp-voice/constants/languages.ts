/**
 * Language Constants for Multi-Language Support
 * Defines supported languages and related metadata
 */

/**
 * Supported languages (ISO 639-1 codes)
 */
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'it'] as const;

/**
 * Supported language type
 */
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Language names in their native representation
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
};

/**
 * Language flag emojis
 */
export const LANGUAGE_EMOJIS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇵🇹',
  it: '🇮🇹',
};

/**
 * franc-min language codes to our supported languages
 * franc-min uses ISO 639-3 codes, we need to map them
 */
export const FRANC_TO_SUPPORTED: Record<string, SupportedLanguage> = {
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  por: 'pt',
  ita: 'it',
};

/**
 * Default fallback language
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Minimum text length for reliable language detection
 */
export const MIN_TEXT_LENGTH_FOR_DETECTION = 10;

/**
 * Minimum confidence score for language detection (0-1)
 */
export const MIN_CONFIDENCE_SCORE = 0.5;

/**
 * Language detection cache TTL (milliseconds)
 */
export const LANGUAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a language code is supported
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(code as SupportedLanguage);
}

/**
 * Get language name with emoji
 */
export function getLanguageDisplay(code: SupportedLanguage): string {
  return `${LANGUAGE_EMOJIS[code]} ${LANGUAGE_NAMES[code]}`;
}

/**
 * Parse language code from various formats
 */
export function parseLanguageCode(code: string): SupportedLanguage | null {
  const normalized = code.toLowerCase().trim();

  // Check if it's already a supported language
  if (isSupportedLanguage(normalized)) {
    return normalized;
  }

  // Check if it's a franc code
  if (FRANC_TO_SUPPORTED[normalized]) {
    return FRANC_TO_SUPPORTED[normalized];
  }

  // Check for language-region codes (e.g., 'en-US' -> 'en')
  const languageOnly = normalized.split('-')[0];
  if (languageOnly && isSupportedLanguage(languageOnly)) {
    return languageOnly;
  }

  return null;
}
