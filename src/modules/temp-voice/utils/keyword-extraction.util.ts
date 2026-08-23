/**
 * Keyword Extraction Utility
 *
 * Extracts meaningful keywords from channel names for moderation review.
 * Removes stopwords, filters by length, and normalizes tokens.
 */

import { NameNormalizationService } from '../services/moderation/name-normalization.service.js';
import { STOPWORDS } from '../constants/moderation-patterns.js';

/**
 * Extract keywords from text
 */
export function extractKeywords(
  text: string,
  options: {
    minLength?: number;
    maxKeywords?: number;
    includeStopwords?: boolean;
  } = {}
): string[] {
  const { minLength = 3, maxKeywords = 10, includeStopwords = false } = options;

  // Tokenize the text
  const tokens = tokenize(text);

  // Filter stopwords if requested
  const filtered = includeStopwords ? tokens : filterStopwords(tokens);

  // Filter by length
  const lengthFiltered = filtered.filter((token) => token.length >= minLength);

  // Remove duplicates (case-insensitive)
  const unique = Array.from(new Set(lengthFiltered.map((token) => token.toLowerCase())));

  // Limit number of keywords
  return unique.slice(0, maxKeywords);
}

/**
 * Tokenize text into individual words
 */
export function tokenize(text: string): string[] {
  // Normalize first
  const normalizationService = new NameNormalizationService();
  const normalized = normalizationService.normalize(text);

  // Split on word boundaries (spaces, punctuation, symbols)
  const tokens = normalized.normalized
    .split(/[\s\-_.,;:!?()[\]{}'"]+/)
    .filter((token) => token.length > 0);

  return tokens;
}

/**
 * Filter out common stopwords
 */
export function filterStopwords(tokens: string[]): string[] {
  return tokens.filter((token) => !STOPWORDS.has(token.toLowerCase()));
}

/**
 * Extract keywords with context (includes original positions)
 */
export interface KeywordWithContext {
  keyword: string;
  position: number;
  context: string; // Surrounding text
}

export function extractKeywordsWithContext(
  text: string,
  options: {
    minLength?: number;
    maxKeywords?: number;
    contextWindow?: number;
  } = {}
): KeywordWithContext[] {
  const { minLength = 3, maxKeywords = 10, contextWindow = 20 } = options;

  const keywords = extractKeywords(text, { minLength, maxKeywords });
  const results: KeywordWithContext[] = [];

  for (const keyword of keywords) {
    // Find position of keyword in original text (case-insensitive)
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
    const match = text.match(regex);

    if (match && match.index !== undefined) {
      const position = match.index;
      const start = Math.max(0, position - contextWindow);
      const end = Math.min(text.length, position + keyword.length + contextWindow);
      const context = text.substring(start, end);

      results.push({
        keyword,
        position,
        context,
      });
    }
  }

  return results;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract n-grams (sequences of n words) from text
 */
export function extractNGrams(text: string, n: number = 2): string[] {
  const tokens = tokenize(text);

  if (tokens.length < n) {
    return [];
  }

  const ngrams: string[] = [];

  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join(' ');
    ngrams.push(ngram);
  }

  return ngrams;
}

/**
 * Extract both unigrams and bigrams
 */
export function extractUnigramsAndBigrams(text: string): {
  unigrams: string[];
  bigrams: string[];
} {
  const unigrams = extractKeywords(text);
  const bigrams = extractNGrams(text, 2);

  return { unigrams, bigrams };
}

/**
 * Score keywords by potential severity
 * Higher score = more likely to be problematic
 */
export function scoreKeywords(keywords: string[]): Map<string, number> {
  const scores = new Map<string, number>();

  for (const keyword of keywords) {
    let score = 0;

    // Length factor (very short or very long is suspicious)
    if (keyword.length <= 2) {
      score += 2;
    } else if (keyword.length >= 15) {
      score += 1;
    }

    // Repeated characters (suspicious)
    const repeatedChars = /(.)\1{2,}/;
    if (repeatedChars.test(keyword)) {
      score += 3;
    }

    // All caps (suspicious)
    if (keyword === keyword.toUpperCase() && keyword.length > 3) {
      score += 2;
    }

    // Numbers mixed with letters (suspicious obfuscation)
    const hasNumbers = /\d/.test(keyword);
    const hasLetters = /[a-z]/i.test(keyword);
    if (hasNumbers && hasLetters) {
      score += 2;
    }

    // Special characters (unusual in normal words)
    const specialChars = /[^a-z0-9\s]/i;
    if (specialChars.test(keyword)) {
      score += 1;
    }

    scores.set(keyword, score);
  }

  return scores;
}

/**
 * Get top N keywords by severity score
 */
export function getTopKeywordsBySeverity(
  text: string,
  n: number = 5
): Array<{ keyword: string; score: number }> {
  const keywords = extractKeywords(text);
  const scores = scoreKeywords(keywords);

  const sorted = Array.from(scores.entries())
    .map(([keyword, score]) => ({ keyword, score }))
    .sort((a, b) => b.score - a.score);

  return sorted.slice(0, n);
}
