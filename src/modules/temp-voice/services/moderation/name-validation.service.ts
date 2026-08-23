/**
 * Name Validation Service
 * Validates channel names against patterns and heuristics
 */

import { RE2 } from 're2-wasm';
import {
  ReasonCode,
  type ValidationResult,
  type ModerationContext,
  type NormalizedName,
  type PatternMatch,
  type HeuristicConfig,
} from '../../models/name-moderation.model.js';
import { NameNormalizationService } from './name-normalization.service.js';
import {
  getBasePatterns,
  PatternCategory,
  PATTERN_SEVERITY,
  DEFAULT_HEURISTIC_CONFIG,
  STRICT_HEURISTIC_CONFIG,
  DISCORD_NAME_CONSTRAINTS,
  STOPWORDS,
} from '../../constants/moderation-patterns.js';
import { patternRegistry } from '../../constants/patterns/patterns-registry.js';
import { isSupportedLanguage, type SupportedLanguage } from '../../constants/languages.js';

/**
 * Service for validating channel names
 */
export class NameValidationService {
  private normalizationService: NameNormalizationService;
  private basePatterns: Record<PatternCategory, RegExp[]>;
  private problematicPatterns: Set<string> = new Set();
  private readonly MAX_TEXT_LENGTH = 1000;
  // Cache RE2 instances to avoid WASM memory exhaustion
  private re2Cache: Map<string, RE2> = new Map();

  constructor() {
    this.normalizationService = new NameNormalizationService();
    this.basePatterns = this.compilePatterns();
  }

  /**
   * Compile regex patterns from strings
   */
  private compilePatterns(): Record<PatternCategory, RegExp[]> {
    const patterns = getBasePatterns();
    const compiled = {} as Record<PatternCategory, RegExp[]>;

    for (const [category, patternStrings] of Object.entries(patterns)) {
      // Obfuscation patterns need case-sensitive matching, others are case-insensitive
      const flags = category === PatternCategory.OBFUSCATION ? 'g' : 'gi';
      compiled[category as PatternCategory] = patternStrings.map(
        (pattern) => new RegExp(pattern, flags)
      );
    }

    return compiled;
  }

  /**
   * Validate a channel name
   * @param name - The name to validate
   * @param context - Moderation context
   * @returns Validation result
   */
  async validate(name: string, context: ModerationContext): Promise<ValidationResult> {
    const startTime = Date.now();

    // Normalize the name
    const normalized = this.normalizationService.normalize(name);

    // Check Discord constraints first
    const constraintCheck = this.checkDiscordConstraints(name);
    if (!constraintCheck.isValid) {
      return {
        isAllowed: false,
        reasonCodes: constraintCheck.reasonCodes,
        normalizedName: normalized.normalized,
        matchedPatterns: [],
        metadata: {
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    // If allowlist mode is enabled, check if name is in allowlist
    if (context.allowListEnabled) {
      const isAllowlisted = this.checkAllowlist(normalized, context.allowedKeywords);
      if (!isAllowlisted) {
        return {
          isAllowed: false,
          reasonCodes: [ReasonCode.BLOCKLIST_MATCH],
          normalizedName: normalized.normalized,
          matchedPatterns: [],
          metadata: {
            processingTimeMs: Date.now() - startTime,
            note: 'Not in allowlist (allowlist mode enabled)',
          },
        };
      }
      // If in allowlist, allow it (don't check patterns/heuristics)
      return {
        isAllowed: true,
        reasonCodes: [],
        normalizedName: normalized.normalized,
        matchedPatterns: [],
        metadata: {
          processingTimeMs: Date.now() - startTime,
          note: 'Allowed by allowlist',
        },
      };
    }

    // Check against patterns
    const patternMatches = await this.checkPatterns(normalized, context);

    // Calculate heuristic score
    const heuristicConfig = context.strictMode ? STRICT_HEURISTIC_CONFIG : DEFAULT_HEURISTIC_CONFIG;
    const heuristicResult = this.calculateHeuristicScore(normalized, heuristicConfig);

    // Determine if allowed
    const hasPatternMatches = patternMatches.length > 0;
    const failsHeuristics = heuristicResult.score >= heuristicConfig.rejectionThreshold;
    const isAllowed = !hasPatternMatches && !failsHeuristics;

    // Collect reason codes
    const reasonCodes: ReasonCode[] = [];
    if (hasPatternMatches) {
      // Add reason codes based on matched pattern types
      const uniqueTypes = new Set(patternMatches.map((m) => m.patternType));
      for (const type of uniqueTypes) {
        switch (type) {
          case PatternCategory.PROFANITY:
            reasonCodes.push(ReasonCode.PROFANITY);
            break;
          case PatternCategory.HATE_SPEECH:
            reasonCodes.push(ReasonCode.HATE_SPEECH);
            break;
          case PatternCategory.SPAM:
            reasonCodes.push(ReasonCode.SPAM_PATTERN);
            break;
          case PatternCategory.OBFUSCATION:
            reasonCodes.push(ReasonCode.OBFUSCATION);
            break;
          case PatternCategory.INVALID_CHARS:
            reasonCodes.push(ReasonCode.INVALID_CHARACTERS);
            break;
          case PatternCategory.CUSTOM:
            reasonCodes.push(ReasonCode.CUSTOM_PATTERN);
            break;
        }
      }
    }

    if (failsHeuristics) {
      reasonCodes.push(...heuristicResult.reasonCodes);
    }

    return {
      isAllowed,
      reasonCodes,
      normalizedName: normalized.normalized,
      matchedPatterns: patternMatches,
      heuristicScore: heuristicResult.score,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        heuristicBreakdown: heuristicResult.breakdown,
      },
    };
  }

  /**
   * Check Discord naming constraints
   */
  private checkDiscordConstraints(name: string): {
    isValid: boolean;
    reasonCodes: ReasonCode[];
  } {
    const reasonCodes: ReasonCode[] = [];

    // Check both original and trimmed length to catch whitespace-only names
    const trimmedName = name.trim();
    if (trimmedName.length < DISCORD_NAME_CONSTRAINTS.minLength) {
      reasonCodes.push(ReasonCode.TOO_SHORT);
    }

    if (name.length > DISCORD_NAME_CONSTRAINTS.maxLength) {
      reasonCodes.push(ReasonCode.TOO_LONG);
    }

    // Note: Discord voice channels are more lenient with characters than text channels
    // We'll allow most characters but flag truly problematic ones

    return {
      isValid: reasonCodes.length === 0,
      reasonCodes,
    };
  }

  /**
   * Check if name is in allowlist
   */
  private checkAllowlist(normalized: NormalizedName, allowedKeywords: string[]): boolean {
    if (allowedKeywords.length === 0) return false;

    const normalizedAllowlist = allowedKeywords.map((k) => k.toLowerCase().trim());

    // Check exact match
    if (normalizedAllowlist.includes(normalized.normalized)) {
      return true;
    }

    // Check if all tokens are allowed
    const allTokensAllowed = normalized.tokens.every((token) =>
      normalizedAllowlist.includes(token)
    );

    return allTokensAllowed;
  }

  /**
   * Check name against patterns
   */
  private async checkPatterns(
    normalized: NormalizedName,
    context: ModerationContext
  ): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    // Test against all variations of the normalized name
    const testStrings = [
      normalized.normalized,
      normalized.withoutSeparators,
      normalized.decodedLeetspeak,
      normalized.decodedLeetspeakWithSpaces,
      normalized.unicodeNormalized,
      normalized.withoutZeroWidth,
    ];

    // Determine which languages to check
    const languagesToCheck: SupportedLanguage[] = [];

    if (context.primaryLanguage && isSupportedLanguage(context.primaryLanguage)) {
      languagesToCheck.push(context.primaryLanguage as SupportedLanguage);
    }

    if (context.additionalLanguages) {
      for (const lang of context.additionalLanguages) {
        if (isSupportedLanguage(lang) && !languagesToCheck.includes(lang as SupportedLanguage)) {
          languagesToCheck.push(lang as SupportedLanguage);
        }
      }
    }

    // If no languages specified, check base patterns only
    if (languagesToCheck.length === 0) {
      console.debug('[Name Validation] No languages specified, using base patterns only');
      // Check base patterns (fallback to original behavior)
      for (const [category, patterns] of Object.entries(this.basePatterns)) {
        for (const pattern of patterns) {
          for (const testString of testStrings) {
            try {
              const match = this.testPatternWithTimeout(pattern, testString);
              if (match) {
                matches.push({
                  pattern: pattern.source,
                  patternType: category,
                  matchedText: match[0],
                  index: match.index ?? 0,
                  severity: PATTERN_SEVERITY[category as PatternCategory],
                });
              }
            } catch (error) {
              // Timeout or error - log and skip this pattern
              console.warn(`Pattern timeout or error: ${pattern.source}`, error);
            }
          }
        }
      }
    } else {
      // Check multi-language patterns
      console.debug(
        `[Name Validation] Checking patterns for languages: ${languagesToCheck.join(', ')}`
      );
      const languagePatterns = await patternRegistry.getMultiLanguagePatterns(languagesToCheck);

      console.debug(
        `[Name Validation] Loaded ${languagePatterns.profanity.length} profanity patterns, ${languagePatterns.hateSpech.length} hate speech patterns, ${languagePatterns.spam.length} spam patterns`
      );

      // Check profanity patterns
      for (const patternStr of languagePatterns.profanity) {
        const pattern = new RegExp(patternStr, 'gi');
        for (const testString of testStrings) {
          try {
            const match = this.testPatternWithTimeout(pattern, testString);
            if (match) {
              matches.push({
                pattern: patternStr,
                patternType: PatternCategory.PROFANITY,
                matchedText: match[0],
                index: match.index ?? 0,
                severity: PATTERN_SEVERITY[PatternCategory.PROFANITY],
              });
            }
          } catch (error) {
            console.warn(`Pattern timeout or error: ${patternStr}`, error);
          }
        }
      }

      // Check hate speech patterns
      for (const patternStr of languagePatterns.hateSpech) {
        const pattern = new RegExp(patternStr, 'gi');
        for (const testString of testStrings) {
          try {
            const match = this.testPatternWithTimeout(pattern, testString);
            if (match) {
              matches.push({
                pattern: patternStr,
                patternType: PatternCategory.HATE_SPEECH,
                matchedText: match[0],
                index: match.index ?? 0,
                severity: PATTERN_SEVERITY[PatternCategory.HATE_SPEECH],
              });
            }
          } catch (error) {
            console.warn(`Pattern timeout or error: ${patternStr}`, error);
          }
        }
      }

      // Check spam patterns
      for (const patternStr of languagePatterns.spam) {
        const pattern = new RegExp(patternStr, 'gi');
        for (const testString of testStrings) {
          try {
            const match = this.testPatternWithTimeout(pattern, testString);
            if (match) {
              matches.push({
                pattern: patternStr,
                patternType: PatternCategory.SPAM,
                matchedText: match[0],
                index: match.index ?? 0,
                severity: PATTERN_SEVERITY[PatternCategory.SPAM],
              });
            }
          } catch (error) {
            console.warn(`Pattern timeout or error: ${patternStr}`, error);
          }
        }
      }

      // Still check base patterns for obfuscation and invalid chars (language-independent)
      const languageIndependentCategories = [
        PatternCategory.OBFUSCATION,
        PatternCategory.INVALID_CHARS,
      ];

      for (const category of languageIndependentCategories) {
        const patterns = this.basePatterns[category];
        if (patterns) {
          for (const pattern of patterns) {
            for (const testString of testStrings) {
              try {
                const match = this.testPatternWithTimeout(pattern, testString);
                if (match) {
                  matches.push({
                    pattern: pattern.source,
                    patternType: category,
                    matchedText: match[0],
                    index: match.index ?? 0,
                    severity: PATTERN_SEVERITY[category],
                  });
                }
              } catch (error) {
                console.warn(`Pattern timeout or error: ${pattern.source}`, error);
              }
            }
          }
        }
      }
    }

    // Check custom guild patterns
    if (context.customPatterns && context.customPatterns.length > 0) {
      for (const patternString of context.customPatterns) {
        try {
          const pattern = new RegExp(patternString, 'gi');
          for (const testString of testStrings) {
            const match = this.testPatternWithTimeout(pattern, testString);
            if (match) {
              matches.push({
                pattern: patternString,
                patternType: PatternCategory.CUSTOM,
                matchedText: match[0],
                index: match.index ?? 0,
                severity: PATTERN_SEVERITY[PatternCategory.CUSTOM],
              });
            }
          }
        } catch {
          // Invalid regex or timeout - skip silently
          // Custom patterns are user-provided and may be invalid
        }
      }
    }

    // Deduplicate matches (same pattern/text)
    const uniqueMatches = this.deduplicateMatches(matches);

    return uniqueMatches;
  }

  /**
   * Get or create a cached RE2 instance for a given pattern
   * This reduces memory pressure from RE2-WASM's fixed 16MB limit
   */
  private getOrCreateRE2(source: string, flags: string): RE2 | null {
    const cacheKey = `${source}|||${flags}`;

    // Check cache first
    if (this.re2Cache.has(cacheKey)) {
      const cached = this.re2Cache.get(cacheKey);
      return cached || null;
    }

    // Check if this pattern previously failed
    if (this.problematicPatterns.has(cacheKey)) {
      return null;
    }

    try {
      // Ensure unicode flag is present (RE2-WASM requirement)
      const finalFlags = flags.includes('u') ? flags : flags + 'u';
      const re2Pattern = new RE2(source, finalFlags);

      // Cache for reuse
      this.re2Cache.set(cacheKey, re2Pattern);
      return re2Pattern;
    } catch {
      // Mark as problematic to avoid retrying
      this.problematicPatterns.add(cacheKey);
      return null;
    }
  }

  /**
   * Test regex pattern with RE2 (WebAssembly) for safe execution
   * RE2 guarantees linear time execution and prevents ReDoS attacks
   * by not supporting backtracking-based features like backreferences.
   * Using the WASM port which works across all platforms without native compilation.
   */
  private testPatternWithTimeout(pattern: RegExp, text: string): RegExpExecArray | null {
    try {
      // Limit text length as an additional safety measure
      const testText =
        text.length > this.MAX_TEXT_LENGTH ? text.substring(0, this.MAX_TEXT_LENGTH) : text;

      // Get cached or create new RE2 instance
      const re2Pattern = this.getOrCreateRE2(pattern.source, pattern.flags);
      if (!re2Pattern) {
        return null;
      }

      const result = re2Pattern.exec(testText);

      // RE2 returns an array with match results or null
      // Convert to RegExpExecArray format for consistency
      if (result && Array.isArray(result)) {
        return result as RegExpExecArray;
      }

      return null;
    } catch {
      // Unexpected error during execution - return null to skip this pattern
      return null;
    }
  }

  /**
   * Deduplicate pattern matches
   */
  private deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
    const seen = new Set<string>();
    const unique: PatternMatch[] = [];

    for (const match of matches) {
      const key = `${match.patternType}:${match.matchedText}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(match);
      }
    }

    return unique;
  }

  /**
   * Calculate heuristic score
   */
  private calculateHeuristicScore(
    normalized: NormalizedName,
    config: HeuristicConfig
  ): { score: number; reasonCodes: ReasonCode[]; breakdown: Record<string, number> } {
    let score = 0;
    const reasonCodes: ReasonCode[] = [];
    const breakdown: Record<string, number> = {};

    // Check symbol density
    const symbolDensity = this.normalizationService.calculateSymbolDensity(normalized.normalized);
    if (symbolDensity > config.maxSymbolDensity) {
      const symbolScore = Math.floor((symbolDensity - config.maxSymbolDensity) * 10);
      score += symbolScore;
      breakdown.symbolDensity = symbolScore;
      reasonCodes.push(ReasonCode.EXCESSIVE_SYMBOLS);
    }

    // Check character repetition
    const repetition = this.normalizationService.detectRepetition(normalized.normalized);
    if (repetition.maxRepetition > config.maxRepetition) {
      const repScore = repetition.maxRepetition - config.maxRepetition;
      score += repScore;
      breakdown.repetition = repScore;
      reasonCodes.push(ReasonCode.EXCESSIVE_REPETITION);
    }

    // Check for suspicious tokens
    const suspiciousTokenScore = this.analyzeSuspiciousTokens(normalized.tokens, config);
    if (suspiciousTokenScore > config.maxSuspiciousTokenScore) {
      score += suspiciousTokenScore;
      breakdown.suspiciousTokens = suspiciousTokenScore;
      reasonCodes.push(ReasonCode.SUSPICIOUS_TOKENS);
    }

    // Check for obfuscation indicators
    const obfuscationScore = this.detectObfuscationScore(normalized);
    if (obfuscationScore > 0) {
      score += obfuscationScore;
      breakdown.obfuscation = obfuscationScore;
      if (!reasonCodes.includes(ReasonCode.OBFUSCATION)) {
        reasonCodes.push(ReasonCode.OBFUSCATION);
      }
    }

    return { score, reasonCodes, breakdown };
  }

  /**
   * Analyze tokens for suspicious patterns
   */
  private analyzeSuspiciousTokens(tokens: string[], config: HeuristicConfig): number {
    let score = 0;

    for (const token of tokens) {
      // Skip short tokens and stopwords
      if (token.length < config.minTokenLength || STOPWORDS.has(token.toLowerCase())) {
        continue;
      }

      // Very short but not filtered tokens
      if (token.length === 1) {
        score += 0.5;
      }

      // All uppercase single word
      if (token === token.toUpperCase() && token.length > 3) {
        score += 0.5;
      }

      // Mixed numbers and letters heavily
      const letterCount = (token.match(/[a-z]/gi) || []).length;
      const numberCount = (token.match(/[0-9]/g) || []).length;
      if (letterCount > 0 && numberCount > 0 && numberCount / token.length > 0.3) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Detect obfuscation patterns and return a score
   */
  private detectObfuscationScore(normalized: NormalizedName): number {
    let score = 0;

    // If removing separators significantly shortens the text, it's suspicious
    const lengthDiff = normalized.normalized.length - normalized.withoutSeparators.length;
    if (lengthDiff > normalized.normalized.length * 0.3) {
      score += 2; // 30% of characters were separators
    }

    // If leetspeak decoding changes the text significantly
    if (
      normalized.decodedLeetspeak !== normalized.withoutSeparators &&
      this.normalizationService.calculateSimilarity(
        normalized.decodedLeetspeak,
        normalized.withoutSeparators
      ) < 0.7
    ) {
      score += 1;
    }

    // Check for homoglyphs
    if (this.normalizationService.detectHomoglyphs(normalized.original)) {
      score += 2;
    }

    // Check for excessive non-ASCII
    const nonAsciiCount = this.normalizationService.countNonAscii(normalized.original);
    if (nonAsciiCount > 0 && nonAsciiCount / normalized.original.length > 0.3) {
      score += 1;
    }

    return score;
  }

  /**
   * Test if a pattern string is a valid regex
   * @param pattern - Pattern to test
   * @returns True if valid
   */
  static isValidPattern(pattern: string): boolean {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }
}
