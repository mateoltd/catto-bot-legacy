/**
 * Auto-Rename Service
 * Generates safe alternative names when inappropriate names are detected
 */

import type { RenameContext, RenameResult } from '../../models/name-moderation.model.js';
import { RenameStrategy } from '../../models/name-moderation.model.js';
import {
  SAFE_ADJECTIVES,
  SAFE_NOUNS,
  SAFE_TEMPLATES,
  THEMED_NAMES,
  NUMBERED_TEMPLATES,
  TIME_BASED_TEMPLATES,
  getTimePeriod,
} from '../../constants/safe-names.js';
import {
  DISCORD_NAME_CONSTRAINTS,
  COLLISION_SUFFIXES,
  MAX_COLLISION_ATTEMPTS,
} from '../../constants/moderation-patterns.js';
import { safeNameRegistry } from '../../constants/safe-names/safe-names-registry.js';
import {
  isSupportedLanguage,
  type SupportedLanguage,
  DEFAULT_LANGUAGE,
} from '../../constants/languages.js';

/**
 * Service for generating safe replacement channel names
 */
export class AutoRenameService {
  /**
   * Generate a safe replacement name
   * @param context - Rename context
   * @returns Rename result with suggested name
   */
  async generateSafeName(context: RenameContext): Promise<RenameResult> {
    // Determine language for safe name generation
    const language = this.determineLanguage(context);

    // Try strategies in order of preference
    const strategies: Array<() => Promise<string | null>> = [
      () => this.tryCreativeCombo(context, language),
      () => this.trySafeTemplate(context, language),
      async () => this.tryThemedName(context),
      async () => this.tryTimeBased(context),
      async () => this.trySequential(context),
    ];

    let suggestedName: string | null = null;
    let strategyUsed: RenameStrategy | null = null;

    for (const strategy of strategies) {
      const candidate = await strategy();
      if (candidate && this.validateDiscordConstraints(candidate)) {
        suggestedName = candidate;
        strategyUsed = this.getStrategyFromName(candidate);
        break;
      }
    }

    // Fallback: use a generic numbered template
    if (!suggestedName) {
      suggestedName = this.getFallbackName();
      strategyUsed = RenameStrategy.FALLBACK;
    }

    // Handle collisions
    let collisionAttempts = 0;
    let finalName = suggestedName;
    const collisionChecked = context.existingChannelNames.length > 0;

    if (collisionChecked) {
      const result = this.handleCollision(suggestedName, context.existingChannelNames);
      finalName = result.name;
      collisionAttempts = result.attempts;
    }

    return {
      suggestedName: finalName,
      strategyUsed: strategyUsed || RenameStrategy.FALLBACK,
      collisionChecked,
      collisionAttempts,
    };
  }

  /**
   * Determine language for safe name generation
   * @param context - Rename context
   * @returns Language code
   */
  private determineLanguage(context: RenameContext): SupportedLanguage {
    if (context.language && isSupportedLanguage(context.language)) {
      return context.language as SupportedLanguage;
    }
    return DEFAULT_LANGUAGE;
  }

  /**
   * Generate name using safe template strategy
   * @param context - Rename context
   * @param language - Language for name generation
   * @returns Template-based name or null
   */
  private async trySafeTemplate(
    _context: RenameContext,
    language: SupportedLanguage
  ): Promise<string | null> {
    try {
      // Use language-specific safe name from registry
      const name = await safeNameRegistry.getRandomSafeName(language, true);
      return name;
    } catch {
      // Fallback to original templates
      const template = this.getRandomElement(SAFE_TEMPLATES);
      return template;
    }
  }

  /**
   * Generate name using creative combo strategy (Adjective + Noun)
   * @param context - Rename context
   * @param language - Language for name generation
   * @returns Creative combo name or null
   */
  private async tryCreativeCombo(
    _context: RenameContext,
    language: SupportedLanguage
  ): Promise<string | null> {
    try {
      // Use language-specific adjectives and nouns from registry
      const name = await safeNameRegistry.getRandomSafeName(language, false);
      return name;
    } catch {
      // Fallback to original approach
      const adjective = this.getRandomElement(SAFE_ADJECTIVES);
      const noun = this.getRandomElement(SAFE_NOUNS);
      return `${adjective} ${noun}`;
    }
  }

  /**
   * Generate name using themed strategy
   * @param context - Rename context
   * @returns Themed name or null
   */
  private tryThemedName(context: RenameContext): string | null {
    // Try to detect theme from original name
    const originalLower = context.originalName.toLowerCase();

    // Check for theme keywords
    if (
      originalLower.includes('game') ||
      originalLower.includes('play') ||
      originalLower.includes('raid')
    ) {
      return this.getRandomElement(THEMED_NAMES.gaming);
    }

    if (
      originalLower.includes('study') ||
      originalLower.includes('homework') ||
      originalLower.includes('learn')
    ) {
      return this.getRandomElement(THEMED_NAMES.study);
    }

    if (
      originalLower.includes('music') ||
      originalLower.includes('song') ||
      originalLower.includes('listen')
    ) {
      return this.getRandomElement(THEMED_NAMES.music);
    }

    if (
      originalLower.includes('art') ||
      originalLower.includes('draw') ||
      originalLower.includes('create')
    ) {
      return this.getRandomElement(THEMED_NAMES.creative);
    }

    if (
      originalLower.includes('work') ||
      originalLower.includes('meeting') ||
      originalLower.includes('office')
    ) {
      return this.getRandomElement(THEMED_NAMES.work);
    }

    // Default to social
    return this.getRandomElement(THEMED_NAMES.social);
  }

  /**
   * Generate name using time-based strategy
   * @param context - Rename context
   * @returns Time-based name or null
   */
  private tryTimeBased(_context: RenameContext): string | null {
    const timePeriod = getTimePeriod();
    const template = this.getRandomElement(TIME_BASED_TEMPLATES);
    return template.replace('{time}', timePeriod);
  }

  /**
   * Generate name using sequential strategy
   * @param context - Rename context
   * @returns Sequential name or null
   */
  private trySequential(context: RenameContext): string | null {
    // Find highest number in existing channel names
    let highestNumber = 0;
    const numberPattern = /#?(\d+)/;

    for (const name of context.existingChannelNames) {
      const match = name.match(numberPattern);
      if (match && match[1]) {
        const num = Number.parseInt(match[1], 10);
        if (num > highestNumber) {
          highestNumber = num;
        }
      }
    }

    const nextNumber = highestNumber + 1;
    const template = this.getRandomElement(NUMBERED_TEMPLATES);
    return template.replace('{number}', String(nextNumber));
  }

  /**
   * Get fallback name (last resort)
   * @returns Fallback name
   */
  private getFallbackName(): string {
    return `Voice Channel ${Date.now() % 10000}`;
  }

  /**
   * Handle name collisions with existing channels
   * @param baseName - Base name to check
   * @param existingNames - List of existing channel names
   * @returns Final name with collision resolution and attempt count
   */
  private handleCollision(
    baseName: string,
    existingNames: string[]
  ): { name: string; attempts: number } {
    const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));

    // Check if base name has no collision
    if (!existingSet.has(baseName.toLowerCase())) {
      return { name: baseName, attempts: 0 };
    }

    // Try different suffixes
    let attempts = 0;
    for (let i = 2; i <= MAX_COLLISION_ATTEMPTS; i++) {
      attempts++;

      for (const suffix of COLLISION_SUFFIXES) {
        const candidate = `${baseName}${suffix}${i}`;

        // Check if it exceeds max length
        if (candidate.length > DISCORD_NAME_CONSTRAINTS.maxLength) {
          // Try truncating base name
          const maxBaseLength =
            DISCORD_NAME_CONSTRAINTS.maxLength - suffix.length - String(i).length;
          if (maxBaseLength > 10) {
            const truncated = baseName.slice(0, maxBaseLength).trim();
            const truncatedCandidate = `${truncated}${suffix}${i}`;
            if (!existingSet.has(truncatedCandidate.toLowerCase())) {
              return { name: truncatedCandidate, attempts };
            }
          }
          continue;
        }

        if (!existingSet.has(candidate.toLowerCase())) {
          return { name: candidate, attempts };
        }
      }
    }

    // If all attempts failed, return a unique fallback
    return {
      name: `Channel ${Date.now() % 100000}`,
      attempts: MAX_COLLISION_ATTEMPTS,
    };
  }

  /**
   * Validate that a name meets Discord's naming constraints
   * @param name - Name to validate
   * @returns True if valid
   */
  validateDiscordConstraints(name: string): boolean {
    // Check length
    if (name.length < DISCORD_NAME_CONSTRAINTS.minLength) {
      return false;
    }
    if (name.length > DISCORD_NAME_CONSTRAINTS.maxLength) {
      return false;
    }

    // Check allowed characters
    if (!DISCORD_NAME_CONSTRAINTS.allowedCharsPattern.test(name)) {
      return false;
    }

    // Check that it's not only whitespace
    if (name.trim().length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Determine which strategy was used based on the name pattern
   * @param name - Generated name
   * @returns Strategy enum
   */
  private getStrategyFromName(name: string): RenameStrategy {
    // Check if it's a template
    const templates = SAFE_TEMPLATES as readonly string[];
    if (templates.includes(name)) {
      return RenameStrategy.SAFE_TEMPLATE;
    }

    // Check if it's themed
    for (const themeNames of Object.values(THEMED_NAMES)) {
      const themes = themeNames as readonly string[];
      if (themes.includes(name)) {
        return RenameStrategy.THEMED;
      }
    }

    // Check if it has time period
    const timePeriods = ['Morning', 'Afternoon', 'Evening', 'Night'];
    if (timePeriods.some((period) => name.includes(period))) {
      return RenameStrategy.THEMED;
    }

    // Check if it has numbers
    if (/\d+/.test(name)) {
      return RenameStrategy.SEQUENTIAL;
    }

    // Default to creative combo
    return RenameStrategy.CREATIVE_COMBO;
  }

  /**
   * Get a random element from an array
   * @param array - Array to pick from
   * @returns Random element
   */
  private getRandomElement<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot get random element from empty array');
    }
    const index = Math.floor(Math.random() * array.length);
    const element = array[index];
    if (element === undefined) {
      throw new Error('Random element is undefined');
    }
    return element;
  }
}
