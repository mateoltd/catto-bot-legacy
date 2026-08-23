/**
 * Safe Name Registry
 * Lazy-loads and caches language-specific safe names for auto-renaming
 */

import type { SupportedLanguage } from '../languages.js';

/**
 * Safe name set for a language
 */
export interface LanguageSafeNames {
  adjectives: string[];
  nouns: string[];
  templates: string[];
}

/**
 * Cache entry for safe names
 */
interface SafeNameCacheEntry {
  names: LanguageSafeNames;
  timestamp: number;
}

/**
 * Safe name registry service
 * Manages lazy loading and caching of language-specific safe names
 */
export class SafeNameRegistry {
  private cache: Map<SupportedLanguage, SafeNameCacheEntry> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get safe names for a specific language
   * @param language - Language code
   * @returns Safe name set for the language
   */
  async getSafeNames(language: SupportedLanguage): Promise<LanguageSafeNames> {
    // Check cache first
    const cached = this.getCached(language);
    if (cached) {
      return cached;
    }

    // Load safe names for the language
    const names = await this.loadSafeNames(language);

    // Cache the result
    this.setCached(language, names);

    return names;
  }

  /**
   * Get a random safe name for a language
   * @param language - Language code
   * @param useTemplate - Whether to use a template (true) or generate from adjective + noun (false)
   * @returns A random safe name
   */
  async getRandomSafeName(language: SupportedLanguage, useTemplate = true): Promise<string> {
    const names = await this.getSafeNames(language);

    if (useTemplate && names.templates.length > 0) {
      // Return a random template
      const template = names.templates[Math.floor(Math.random() * names.templates.length)];
      return template || 'Voice Channel';
    }

    // Generate from adjective + noun
    if (names.adjectives.length > 0 && names.nouns.length > 0) {
      const adjective = names.adjectives[Math.floor(Math.random() * names.adjectives.length)];
      const noun = names.nouns[Math.floor(Math.random() * names.nouns.length)];
      if (adjective && noun) {
        return `${adjective} ${noun}`;
      }
    }

    // Fallback
    return 'Voice Channel';
  }

  /**
   * Generate multiple safe name options
   * @param language - Language code
   * @param count - Number of names to generate
   * @returns Array of safe names
   */
  async generateSafeNameOptions(language: SupportedLanguage, count: number = 5): Promise<string[]> {
    const names: string[] = [];
    const seen = new Set<string>();

    // Try to generate unique names
    let attempts = 0;
    const maxAttempts = count * 3;

    while (names.length < count && attempts < maxAttempts) {
      const useTemplate = Math.random() > 0.5;
      const name = await this.getRandomSafeName(language, useTemplate);

      if (!seen.has(name)) {
        names.push(name);
        seen.add(name);
      }

      attempts++;
    }

    return names;
  }

  /**
   * Get adjectives for a language
   * @param language - Language code
   * @returns Array of adjectives
   */
  async getAdjectives(language: SupportedLanguage): Promise<string[]> {
    const names = await this.getSafeNames(language);
    return names.adjectives;
  }

  /**
   * Get nouns for a language
   * @param language - Language code
   * @returns Array of nouns
   */
  async getNouns(language: SupportedLanguage): Promise<string[]> {
    const names = await this.getSafeNames(language);
    return names.nouns;
  }

  /**
   * Get templates for a language
   * @param language - Language code
   * @returns Array of templates
   */
  async getTemplates(language: SupportedLanguage): Promise<string[]> {
    const names = await this.getSafeNames(language);
    return names.templates;
  }

  /**
   * Load safe names for a language
   * @param language - Language code
   * @returns Safe name set
   */
  private async loadSafeNames(language: SupportedLanguage): Promise<LanguageSafeNames> {
    try {
      // Use explicit imports for Vite/Vitest compatibility (dynamic import limitations)
      let module;
      switch (language) {
        case 'en':
          module = await import('./safe-names-en.js');
          break;
        case 'es':
          module = await import('./safe-names-es.js');
          break;
        case 'fr':
          module = await import('./safe-names-fr.js');
          break;
        case 'de':
          module = await import('./safe-names-de.js');
          break;
        case 'pt':
          module = await import('./safe-names-pt.js');
          break;
        case 'it':
          module = await import('./safe-names-it.js');
          break;
        default:
          return {
            adjectives: [],
            nouns: [],
            templates: [],
          };
      }

      const langCode = language.toUpperCase();
      const moduleRecord = module as Record<string, string[]>;
      return {
        adjectives: moduleRecord[`SAFE_ADJECTIVES_${langCode}`] || [],
        nouns: moduleRecord[`SAFE_NOUNS_${langCode}`] || [],
        templates: moduleRecord[`SAFE_NAME_TEMPLATES_${langCode}`] || [],
      };
    } catch (error) {
      // If safe name file doesn't exist, return empty arrays
      console.warn(`Failed to load safe names for language: ${language}`, error);
      return {
        adjectives: [],
        nouns: [],
        templates: [],
      };
    }
  }

  /**
   * Get cached safe names
   * @param language - Language code
   * @returns Cached names or null
   */
  private getCached(language: SupportedLanguage): LanguageSafeNames | null {
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

    return entry.names;
  }

  /**
   * Cache safe names
   * @param language - Language code
   * @param names - Safe name set
   */
  private setCached(language: SupportedLanguage, names: LanguageSafeNames): void {
    this.cache.set(language, {
      names,
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
   * Preload safe names for specific languages
   * Useful for warming up the cache
   * @param languages - Language codes to preload
   */
  async preloadSafeNames(languages: SupportedLanguage[]): Promise<void> {
    await Promise.all(languages.map((lang) => this.getSafeNames(lang)));
  }
}

/**
 * Singleton instance
 */
export const safeNameRegistry = new SafeNameRegistry();
