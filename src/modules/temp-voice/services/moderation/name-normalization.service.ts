/**
 * Name Normalization Service
 * Handles text normalization to detect obfuscated variations
 */

import type { NormalizedName } from '../../models/name-moderation.model.js';

/**
 * Leetspeak character mappings
 */
const LEETSPEAK_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '€': 'e',
  '£': 'l',
  '+': 't',
  '(': 'c',
  ')': 'c',
  '|': 'i',
  '¡': 'i',
  '¢': 'c',
  '₹': 'r',
};

/**
 * Language-specific character normalization
 * Handles accented characters and language-specific substitutions
 */
const LANGUAGE_SPECIFIC_MAP: Record<string, string> = {
  // Lowercase accents (combining multiple language needs)
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  ä: 'ae', // German preference for ä
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'oe', // German preference for ö
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'ue', // German preference for ü
  ñ: 'n',
  ç: 'c',
  ß: 'ss',
  œ: 'oe',
  æ: 'ae',

  // Uppercase accents
  Á: 'a',
  À: 'a',
  Â: 'a',
  Ã: 'a',
  Ä: 'ae',
  É: 'e',
  È: 'e',
  Ê: 'e',
  Ë: 'e',
  Í: 'i',
  Ì: 'i',
  Î: 'i',
  Ï: 'i',
  Ó: 'o',
  Ò: 'o',
  Ô: 'o',
  Õ: 'o',
  Ö: 'oe',
  Ú: 'u',
  Ù: 'u',
  Û: 'u',
  Ü: 'ue',
  Ñ: 'n',
  Ç: 'c',
};

/**
 * Common separators to remove/normalize
 */
const SEPARATORS = /[\s\-_.•·●○◦∙◘◙※⁂⁎⁑⁕※‣⁃∘‧⋅]/g;

/**
 * Zero-width characters to remove
 */
const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

/**
 * Service for normalizing channel names to detect obfuscation
 */
export class NameNormalizationService {
  /**
   * Normalize a name through multiple transformations
   * @param name - The name to normalize
   * @returns Normalized name object with multiple variations
   */
  normalize(name: string): NormalizedName {
    // Basic normalization
    const normalized = this.basicNormalize(name);

    // Remove separators
    const withoutSeparators = this.removeSeparators(normalized);

    // Decode leetspeak (without separators first for aggressive detection)
    const decodedLeetspeak = this.decodeLeetspeak(withoutSeparators);

    // Decode leetspeak but preserve spaces (for word-boundary pattern matching)
    const decodedLeetspeakWithSpaces = this.decodeLeetspeak(normalized);

    // Normalize unicode
    const unicodeNormalized = this.normalizeUnicode(name);

    // Remove zero-width characters
    const withoutZeroWidth = this.removeZeroWidthChars(name);

    // Extract tokens
    const tokens = this.tokenize(normalized);

    return {
      original: name,
      normalized,
      withoutSeparators,
      decodedLeetspeak,
      decodedLeetspeakWithSpaces,
      unicodeNormalized,
      withoutZeroWidth,
      tokens,
    };
  }

  /**
   * Basic normalization: lowercase, trim, collapse whitespace
   * @param text - Text to normalize
   * @returns Normalized text
   */
  private basicNormalize(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' '); // Collapse multiple spaces to single space
  }

  /**
   * Remove common separators
   * @param text - Text to process
   * @returns Text without separators
   */
  removeSeparators(text: string): string {
    return text.replace(SEPARATORS, '');
  }

  /**
   * Decode leetspeak substitutions
   * @param text - Text to decode
   * @returns Text with leetspeak decoded
   */
  decodeLeetspeak(text: string): string {
    let decoded = text.toLowerCase();

    // Replace language-specific characters first
    for (const [accented, normal] of Object.entries(LANGUAGE_SPECIFIC_MAP)) {
      decoded = decoded.split(accented.toLowerCase()).join(normal);
    }

    // Replace each leetspeak character with its normal equivalent
    for (const [leet, normal] of Object.entries(LEETSPEAK_MAP)) {
      decoded = decoded.split(leet).join(normal);
    }

    return decoded;
  }

  /**
   * Normalize unicode characters using NFD (Canonical Decomposition)
   * This helps detect accented characters used to obfuscate
   * @param text - Text to normalize
   * @returns Unicode-normalized text
   */
  normalizeUnicode(text: string): string {
    // NFD: Canonical Decomposition (é becomes e + ´)
    // Then remove combining diacritical marks
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
      .toLowerCase();
  }

  /**
   * Remove zero-width characters (invisible unicode chars)
   * @param text - Text to process
   * @returns Text without zero-width characters
   */
  removeZeroWidthChars(text: string): string {
    return text.replace(ZERO_WIDTH_CHARS, '');
  }

  /**
   * Tokenize text into words/segments
   * @param text - Text to tokenize
   * @returns Array of tokens
   */
  tokenize(text: string): string[] {
    // Split on common delimiters and filter empty strings
    return text.split(/[\s\-_.•·,;:!?()[\]{}]+/).filter((token) => token.length > 0);
  }

  /**
   * Apply comprehensive normalization pipeline for deep comparison
   * This applies all normalizations in sequence for maximum obfuscation detection
   * @param text - Text to normalize
   * @returns Fully normalized text
   */
  deepNormalize(text: string): string {
    let result = text;

    // Remove zero-width characters first
    result = this.removeZeroWidthChars(result);

    // Normalize unicode
    result = this.normalizeUnicode(result);

    // Basic normalization
    result = this.basicNormalize(result);

    // Remove separators
    result = this.removeSeparators(result);

    // Decode leetspeak
    result = this.decodeLeetspeak(result);

    return result;
  }

  /**
   * Calculate similarity between two names (useful for fuzzy matching)
   * Uses Levenshtein distance
   * @param a - First name
   * @param b - Second name
   * @returns Similarity score between 0 and 1 (1 = identical)
   */
  calculateSimilarity(a: string, b: string): number {
    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    if (maxLength === 0) return 1;

    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param a - First string
   * @param b - Second string
   * @returns Edit distance
   */
  private levenshteinDistance(a: string, b: string): number {
    // Initialize matrix with proper dimensions
    const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => {
      const row = Array(a.length + 1).fill(0) as number[];
      row[0] = i;
      return row;
    });

    // Initialize first row
    const firstRow = matrix[0];
    if (firstRow) {
      for (let j = 0; j <= a.length; j++) {
        firstRow[j] = j;
      }
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const rowCurrent = matrix[i];
        const rowPrevious = matrix[i - 1];

        if (rowCurrent && rowPrevious) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            rowCurrent[j] = rowPrevious[j - 1] ?? 0;
          } else {
            rowCurrent[j] = Math.min(
              (rowPrevious[j - 1] ?? 0) + 1, // substitution
              (rowCurrent[j - 1] ?? 0) + 1, // insertion
              (rowPrevious[j] ?? 0) + 1 // deletion
            );
          }
        }
      }
    }

    const lastRow = matrix[b.length];
    return lastRow?.[a.length] ?? 0;
  }

  /**
   * Detect if text contains homoglyphs (visually similar characters)
   * @param text - Text to check
   * @returns True if homoglyphs detected
   */
  detectHomoglyphs(text: string): boolean {
    // Common homoglyph patterns
    const homoglyphPatterns = [
      /[а-яА-Я]/u, // Cyrillic letters that look like Latin
      /[Α-Ωα-ω]/u, // Greek letters
      /[\u0370-\u03FF]/u, // Greek and Coptic
      /[\u0400-\u04FF]/u, // Cyrillic
    ];

    return homoglyphPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Count non-ASCII characters in text
   * @param text - Text to check
   * @returns Count of non-ASCII characters
   */
  countNonAscii(text: string): number {
    // eslint-disable-next-line no-control-regex
    return (text.match(/[^\u0000-\u007F]/g) || []).length;
  }

  /**
   * Detect repeated character patterns
   * @param text - Text to check
   * @returns Object with max repetition count and the repeated character
   */
  detectRepetition(text: string): { maxRepetition: number; character: string | null } {
    if (text.length === 0) {
      return { maxRepetition: 0, character: null };
    }

    let maxRepetition = 1;
    let currentRepetition = 1;
    let repeatedChar: string | null = null;
    let currentChar = text.charAt(0);

    for (let i = 1; i < text.length; i++) {
      const char = text.charAt(i);
      if (char === currentChar) {
        currentRepetition++;
        if (currentRepetition > maxRepetition) {
          maxRepetition = currentRepetition;
          repeatedChar = currentChar;
        }
      } else {
        currentRepetition = 1;
        currentChar = char;
      }
    }

    return { maxRepetition, character: repeatedChar };
  }

  /**
   * Calculate symbol density (ratio of non-alphanumeric to total characters)
   * @param text - Text to analyze
   * @returns Symbol density between 0 and 1
   */
  calculateSymbolDensity(text: string): number {
    if (text.length === 0) return 0;

    const symbolCount = (text.match(/[^a-z0-9\s]/gi) || []).length;
    return symbolCount / text.length;
  }
}
