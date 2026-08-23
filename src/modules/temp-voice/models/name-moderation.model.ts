/**
 * Type definitions for Name Moderation System
 */

/**
 * Reason codes for why a name was flagged or rejected
 */
export enum ReasonCode {
  PROFANITY = 'PROFANITY',
  HATE_SPEECH = 'HATE_SPEECH',
  SPAM_PATTERN = 'SPAM_PATTERN',
  OBFUSCATION = 'OBFUSCATION',
  EXCESSIVE_SYMBOLS = 'EXCESSIVE_SYMBOLS',
  EXCESSIVE_REPETITION = 'EXCESSIVE_REPETITION',
  SUSPICIOUS_TOKENS = 'SUSPICIOUS_TOKENS',
  CUSTOM_PATTERN = 'CUSTOM_PATTERN',
  BLOCKLIST_MATCH = 'BLOCKLIST_MATCH',
  TOO_SHORT = 'TOO_SHORT',
  TOO_LONG = 'TOO_LONG',
  INVALID_CHARACTERS = 'INVALID_CHARACTERS',
}

/**
 * Moderation action to take when a name is flagged
 */
export enum ModerationAction {
  AUTO_RENAME = 'AUTO_RENAME',
  BLOCK = 'BLOCK',
  WARN_ONLY = 'WARN_ONLY',
}

/**
 * Strategies for generating safe replacement names
 */
export enum RenameStrategy {
  SAFE_TEMPLATE = 'SAFE_TEMPLATE',
  CREATIVE_COMBO = 'CREATIVE_COMBO',
  THEMED = 'THEMED',
  SEQUENTIAL = 'SEQUENTIAL',
  USER_PREFERENCE = 'USER_PREFERENCE',
  FALLBACK = 'FALLBACK',
}

/**
 * Result of name normalization
 */
export interface NormalizedName {
  /** Original input name */
  original: string;
  /** Normalized version (lowercase, trimmed, collapsed whitespace) */
  normalized: string;
  /** Version with separators removed */
  withoutSeparators: string;
  /** Version with leetspeak decoded (separators removed first) */
  decodedLeetspeak: string;
  /** Version with leetspeak decoded but spaces preserved (for word-boundary matching) */
  decodedLeetspeakWithSpaces: string;
  /** Version with unicode normalized */
  unicodeNormalized: string;
  /** Version with zero-width chars removed */
  withoutZeroWidth: string;
  /** Tokens extracted from the name */
  tokens: string[];
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** The pattern that matched */
  pattern: string;
  /** Type of pattern (PROFANITY, HATE_SPEECH, etc.) */
  patternType: string;
  /** Matched text */
  matchedText: string;
  /** Position in the string where match occurred */
  index: number;
  /** Severity level (1-10) */
  severity: number;
}

/**
 * Result of name validation
 */
export interface ValidationResult {
  /** Whether the name is allowed */
  isAllowed: boolean;
  /** Reason codes for rejection */
  reasonCodes: ReasonCode[];
  /** Normalized version of the name */
  normalizedName: string;
  /** Patterns that matched (if any) */
  matchedPatterns?: PatternMatch[];
  /** Heuristic score (if calculated) */
  heuristicScore?: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Context for name moderation
 */
export interface ModerationContext {
  /** Guild ID */
  guildId: string;
  /** Channel ID */
  channelId: string;
  /** User ID who made the change */
  userId: string;
  /** Previous channel name (if rename) */
  previousName?: string;
  /** Whether strict mode is enabled */
  strictMode: boolean;
  /** Whether allowlist mode is enabled */
  allowListEnabled: boolean;
  /** Guild-specific custom patterns */
  customPatterns: string[];
  /** Guild-specific allowed keywords */
  allowedKeywords: string[];
  /** Primary language for moderation */
  primaryLanguage?: string;
  /** Additional languages to check */
  additionalLanguages?: string[];
  /** Whether to check all languages or primary only */
  multiLangMode?: boolean;
}

/**
 * Context for generating a safe replacement name
 */
export interface RenameContext {
  /** Original problematic name */
  originalName: string;
  /** Normalized version */
  normalizedName: string;
  /** Guild ID */
  guildId: string;
  /** Channel ID */
  channelId: string;
  /** User ID */
  userId: string;
  /** Reason codes why original was rejected */
  reasonCodes: ReasonCode[];
  /** Existing channel names in the guild (to avoid collisions) */
  existingChannelNames: string[];
  /** Language for safe name generation */
  language?: string;
}

/**
 * Result of safe name generation
 */
export interface RenameResult {
  /** The suggested safe name */
  suggestedName: string;
  /** Strategy used to generate the name */
  strategyUsed: RenameStrategy;
  /** Whether the name was tested for collisions */
  collisionChecked: boolean;
  /** Number of collision resolution attempts */
  collisionAttempts: number;
}

/**
 * Complete moderation result with action taken
 */
export interface ModerationResult {
  /** Validation result */
  validation: ValidationResult;
  /** Action taken */
  actionTaken: ModerationAction;
  /** Rename result (if auto-renamed) */
  renameResult?: RenameResult;
  /** Final name after moderation */
  finalName: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Timestamp when moderation occurred */
  timestamp: Date;
}

/**
 * Configuration for heuristic scoring
 */
export interface HeuristicConfig {
  /** Maximum allowed symbol density (0-1) */
  maxSymbolDensity: number;
  /** Maximum allowed repetition (consecutive identical chars) */
  maxRepetition: number;
  /** Minimum token length to consider */
  minTokenLength: number;
  /** Maximum suspicious token score */
  maxSuspiciousTokenScore: number;
  /** Threshold score above which name is rejected */
  rejectionThreshold: number;
}

/**
 * Moderation pattern definition
 */
export interface ModerationPattern {
  /** Unique ID */
  id: string;
  /** Regex pattern string */
  pattern: string;
  /** Pattern type */
  patternType: string;
  /** Description */
  description?: string;
  /** Severity (1-10) */
  severity: number;
  /** Whether pattern is enabled */
  enabled: boolean;
  /** Whether pattern is case-insensitive */
  caseInsensitive: boolean;
}

/**
 * Keyword queue entry for manual review
 */
export interface KeywordQueueEntry {
  /** Unique ID */
  id: string;
  /** Guild ID */
  guildId: string;
  /** The keyword */
  keyword: string;
  /** Normalized version */
  normalizedKeyword: string;
  /** Source (DISCOVERY_REVOCATION, etc.) */
  source: string;
  /** Context snippet */
  contextSnippet?: string;
  /** Channel ID where detected */
  channelId?: string;
  /** User ID who used it */
  userId?: string;
  /** Approval status */
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'IGNORED';
  /** Number of times detected */
  occurrences: number;
  /** When last seen */
  lastSeenAt: Date;
  /** When created */
  createdAt: Date;
}
