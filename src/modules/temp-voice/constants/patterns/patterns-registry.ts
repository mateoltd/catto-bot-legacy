/**
 * Pattern Registry
 * Lazy-loads and caches language-specific moderation patterns
 */

import type { SupportedLanguage } from '../languages.js';

/**
 * Pattern categories
 */
export type PatternCategory = 'profanity' | 'hateSpech' | 'spam';

/**
 * Pattern set for a language
 */
export interface LanguagePatterns {
  profanity: string[];
  hateSpech: string[];
  spam: string[];
}

/**
 * Cache entry for patterns
 */
interface PatternCacheEntry {
  patterns: LanguagePatterns;
  timestamp: number;
}

/**
 * Pattern registry service
 * Manages lazy loading and caching of language-specific patterns
 */
export class PatternRegistry {
  private cache: Map<SupportedLanguage, PatternCacheEntry> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get patterns for a specific language
   * @param language - Language code
   * @returns Pattern set for the language
   */
  async getPatterns(language: SupportedLanguage): Promise<LanguagePatterns> {
    // Check cache first
    const cached = this.getCached(language);
    if (cached) {
      return cached;
    }

    // Load patterns for the language
    const patterns = await this.loadPatterns(language);

    // Cache the result
    this.setCached(language, patterns);

    return patterns;
  }

  /**
   * Get patterns for multiple languages (combined)
   * @param languages - Array of language codes
   * @returns Combined pattern set
   */
  async getMultiLanguagePatterns(languages: SupportedLanguage[]): Promise<LanguagePatterns> {
    const allPatterns = await Promise.all(languages.map((lang) => this.getPatterns(lang)));

    // Combine all patterns, removing duplicates
    const combined: LanguagePatterns = {
      profanity: [...new Set(allPatterns.flatMap((p) => p.profanity))],
      hateSpech: [...new Set(allPatterns.flatMap((p) => p.hateSpech))],
      spam: [...new Set(allPatterns.flatMap((p) => p.spam))],
    };

    return combined;
  }

  /**
   * Get patterns for a specific category and language(s)
   * @param category - Pattern category
   * @param languages - Language code(s)
   * @returns Array of patterns
   */
  async getCategoryPatterns(
    category: PatternCategory,
    languages: SupportedLanguage | SupportedLanguage[]
  ): Promise<string[]> {
    const languageArray = Array.isArray(languages) ? languages : [languages];
    const patterns = await this.getMultiLanguagePatterns(languageArray);
    return patterns[category];
  }

  /**
   * Load patterns for a language
   * @param language - Language code
   * @returns Pattern set
   */
  private async loadPatterns(language: SupportedLanguage): Promise<LanguagePatterns> {
    try {
      // Use explicit imports for Vite/Vitest compatibility (dynamic import limitations)
      let module;
      switch (language) {
        case 'en':
          module = await import('./patterns-en.js');
          break;
        case 'es':
          module = await import('./patterns-es.js');
          break;
        case 'fr':
          module = await import('./patterns-fr.js');
          break;
        case 'de':
          module = await import('./patterns-de.js');
          break;
        case 'pt':
          module = await import('./patterns-pt.js');
          break;
        case 'it':
          module = await import('./patterns-it.js');
          break;
        default:
          return {
            profanity: [],
            hateSpech: [],
            spam: [],
          };
      }

      const langCode = language.toUpperCase();
      const moduleRecord = module as Record<string, string[]>;
      return {
        profanity: moduleRecord[`PROFANITY_PATTERNS_${langCode}`] || [],
        hateSpech: moduleRecord[`HATE_SPEECH_PATTERNS_${langCode}`] || [],
        spam: moduleRecord[`SPAM_PATTERNS_${langCode}`] || [],
      };
    } catch (error) {
      // If pattern file doesn't exist, return empty patterns
      console.warn(`Failed to load patterns for language: ${language}`, error);
      return {
        profanity: [],
        hateSpech: [],
        spam: [],
      };
    }
  }

  /**
   * Get cached patterns
   * @param language - Language code
   * @returns Cached patterns or null
   */
  private getCached(language: SupportedLanguage): LanguagePatterns | null {
    const entry = this.cache.get(language);

    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(language);
      return null;
    }

    return entry.patterns;
  }

  /**
   * Cache patterns
   * @param language - Language code
   * @param patterns - Pattern set
   */
  private setCached(language: SupportedLanguage, patterns: LanguagePatterns): void {
    this.cache.set(language, {
      patterns,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload patterns for specific languages
   * Useful for warming up the cache
   * @param languages - Language codes to preload
   */
  async preloadPatterns(languages: SupportedLanguage[]): Promise<void> {
    await Promise.all(languages.map((lang) => this.getPatterns(lang)));
  }
}

/**
 * Singleton instance
 */
export const patternRegistry = new PatternRegistry();
