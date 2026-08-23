/**
 * Language Detection Service
 * Detects the language of text using franc-min library
 */

import { francAll } from 'franc-min';
import type { SupportedLanguage } from '../../constants/languages.js';
import {
  FRANC_TO_SUPPORTED,
  DEFAULT_LANGUAGE,
  MIN_TEXT_LENGTH_FOR_DETECTION,
  MIN_CONFIDENCE_SCORE,
  LANGUAGE_CACHE_TTL,
} from '../../constants/languages.js';

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  /** Detected language */
  language: SupportedLanguage;

  /** Confidence score (0-1) */
  confidence: number;

  /** Whether detection was successful or used fallback */
  isFallback: boolean;

  /** All detected languages with scores */
  alternatives?: Array<{ language: SupportedLanguage; confidence: number }>;
}

/**
 * Cache entry for language detection
 */
interface CacheEntry {
  result: LanguageDetectionResult;
  timestamp: number;
}

/**
 * Service for detecting language in text
 */
export class LanguageDetectionService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cache cleanup (every 10 minutes)
    this.cacheCleanupInterval = setInterval(
      () => {
        this.cleanupCache();
      },
      10 * 60 * 1000
    );
  }

  /**
   * Detect the language of text
   * @param text - Text to analyze
   * @param fallbackLanguage - Language to use if detection fails
   * @returns Detection result
   */
  detectLanguage(
    text: string,
    fallbackLanguage: SupportedLanguage = DEFAULT_LANGUAGE
  ): LanguageDetectionResult {
    // Check cache first
    const cached = this.getCached(text);
    if (cached) {
      return cached;
    }

    // Clean and normalize text
    const cleanText = this.normalizeText(text);

    // Check if text is long enough for reliable detection
    if (cleanText.length < MIN_TEXT_LENGTH_FOR_DETECTION) {
      const result: LanguageDetectionResult = {
        language: fallbackLanguage,
        confidence: 0,
        isFallback: true,
      };
      this.setCached(text, result);
      return result;
    }

    try {
      // Use franc-min to detect language (returns array of [iso639-3, confidence])
      const results = francAll(cleanText, { minLength: MIN_TEXT_LENGTH_FOR_DETECTION });

      const firstResult = results[0];
      if (results.length === 0 || !firstResult || firstResult[0] === 'und') {
        // Undefined language or no results
        const result: LanguageDetectionResult = {
          language: fallbackLanguage,
          confidence: 0,
          isFallback: true,
        };
        this.setCached(text, result);
        return result;
      }

      // Convert franc results to our format
      const alternatives: Array<{ language: SupportedLanguage; confidence: number }> = [];
      let primaryLanguage: SupportedLanguage | null = null;
      let primaryConfidence = 0;

      for (const [francCode, score] of results) {
        const supportedLang = FRANC_TO_SUPPORTED[francCode];
        if (supportedLang) {
          // Normalize score to 0-1 range (franc returns larger numbers for better matches)
          const normalizedScore = Math.min(score / 10, 1);

          alternatives.push({
            language: supportedLang,
            confidence: normalizedScore,
          });

          if (!primaryLanguage) {
            primaryLanguage = supportedLang;
            primaryConfidence = normalizedScore;
          }
        }
      }

      // If no supported language detected, use fallback
      if (!primaryLanguage || primaryConfidence < MIN_CONFIDENCE_SCORE) {
        const result: LanguageDetectionResult = {
          language: fallbackLanguage,
          confidence: primaryConfidence,
          isFallback: true,
          alternatives: alternatives.length > 0 ? alternatives : undefined,
        };
        this.setCached(text, result);
        return result;
      }

      const result: LanguageDetectionResult = {
        language: primaryLanguage,
        confidence: primaryConfidence,
        isFallback: false,
        alternatives: alternatives.slice(0, 3), // Top 3 alternatives
      };

      this.setCached(text, result);
      return result;
    } catch {
      // Detection failed, use fallback
      const result: LanguageDetectionResult = {
        language: fallbackLanguage,
        confidence: 0,
        isFallback: true,
      };
      this.setCached(text, result);
      return result;
    }
  }

  /**
   * Detect multiple languages in mixed-language text
   * @param text - Text to analyze
   * @param fallbackLanguage - Fallback language
   * @returns Array of detected languages
   */
  detectMultipleLanguages(
    text: string,
    fallbackLanguage: SupportedLanguage = DEFAULT_LANGUAGE
  ): SupportedLanguage[] {
    const result = this.detectLanguage(text, fallbackLanguage);

    if (result.isFallback) {
      return [fallbackLanguage];
    }

    const languages = [result.language];

    // Add alternatives with high confidence
    if (result.alternatives) {
      for (const alt of result.alternatives) {
        if (alt.confidence >= MIN_CONFIDENCE_SCORE && alt.language !== result.language) {
          languages.push(alt.language);
        }
      }
    }

    return languages;
  }

  /**
   * Get confidence score for a specific language
   * @param text - Text to analyze
   * @param language - Language to check
   * @returns Confidence score (0-1)
   */
  getConfidenceScore(text: string, language: SupportedLanguage): number {
    const result = this.detectLanguage(text);

    if (result.language === language) {
      return result.confidence;
    }

    if (result.alternatives) {
      const alt = result.alternatives.find((a) => a.language === language);
      if (alt) {
        return alt.confidence;
      }
    }

    return 0;
  }

  /**
   * Normalize text for detection
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove special characters, keep letters and numbers
      .toLowerCase();
  }

  /**
   * Get cached result
   */
  private getCached(text: string): LanguageDetectionResult | null {
    const entry = this.cache.get(text);

    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > LANGUAGE_CACHE_TTL) {
      this.cache.delete(text);
      return null;
    }

    return entry.result;
  }

  /**
   * Set cached result
   */
  private setCached(text: string, result: LanguageDetectionResult): void {
    // Limit cache size
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }

    this.cache.set(text, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > LANGUAGE_CACHE_TTL) {
        entriesToDelete.push(key);
      }
    }

    for (const key of entriesToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.cache.clear();
  }
}
