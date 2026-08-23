/**
 * Message Template Parsing
 * Replaces placeholders with actual values
 */

import { TemplateVariables } from '../types/xp-text.types.js';

/**
 * Replace placeholders in a template string
 * Supported placeholders:
 * - {user} - User mention
 * - {userId} - User ID
 * - {username} - Username
 * - {level} - Current level
 * - {xpGain} - XP gained
 * - {totalXp} - Total XP
 * - {nextLevelXp} - XP needed for next level
 * - {progress} - Progress percentage (0-100)
 * - {type} - XP type label (Text or Voice)
 *
 * @param template Template string with placeholders
 * @param variables Variable values to replace
 * @returns Processed template string
 */
export function parseTemplate(template: string, variables: TemplateVariables): string {
  let result = template;

  // Replace all placeholders
  result = result.replace(/{user}/g, variables.user);
  result = result.replace(/{userId}/g, variables.userId);
  result = result.replace(/{username}/g, variables.username);
  result = result.replace(/{level}/g, variables.level.toString());
  result = result.replace(/{xpGain}/g, variables.xpGain.toString());
  result = result.replace(/{totalXp}/g, variables.totalXp.toString());
  result = result.replace(/{nextLevelXp}/g, variables.nextLevelXp.toString());
  result = result.replace(/{progress}/g, Math.floor(variables.progress * 100).toString());
  result = result.replace(/{type}/g, variables.type);

  return result;
}

/**
 * Validate template string
 * Checks for invalid placeholders
 *
 * @param template Template string to validate
 * @returns Object with valid boolean and array of unknown placeholders
 */
export function validateTemplate(template: string): {
  valid: boolean;
  unknownPlaceholders: string[];
} {
  const validPlaceholders = [
    '{user}',
    '{userId}',
    '{username}',
    '{level}',
    '{xpGain}',
    '{totalXp}',
    '{nextLevelXp}',
    '{progress}',
    '{type}',
  ];

  // Find all placeholders in template
  const placeholderRegex = /{[^}]+}/g;
  const foundPlaceholders = template.match(placeholderRegex) || [];

  // Check for unknown placeholders
  const unknownPlaceholders = foundPlaceholders.filter(
    (placeholder) => !validPlaceholders.includes(placeholder)
  );

  return {
    valid: unknownPlaceholders.length === 0,
    unknownPlaceholders,
  };
}

/**
 * Get list of available placeholders
 *
 * @returns Array of placeholder strings with descriptions
 */
export function getAvailablePlaceholders(): Array<{ placeholder: string; description: string }> {
  return [
    { placeholder: '{user}', description: 'User mention (@User#1234)' },
    { placeholder: '{userId}', description: 'User ID (123456789)' },
    { placeholder: '{username}', description: 'Username without discriminator' },
    { placeholder: '{level}', description: 'Current level number' },
    { placeholder: '{xpGain}', description: 'XP gained from this message' },
    { placeholder: '{totalXp}', description: 'Total XP amount' },
    { placeholder: '{nextLevelXp}', description: 'XP needed for next level' },
    { placeholder: '{progress}', description: 'Progress percentage (0-100)' },
    { placeholder: '{type}', description: 'XP type (Text or Voice)' },
  ];
}

/**
 * Generate default templates for various scenarios
 */
export const DEFAULT_TEMPLATES = {
  levelUp: '🎉 {user} reached text level {level}!',
  levelUpDetailed:
    "🎉 Congratulations {user}! You've reached **Level {level}**! ({totalXp}/{nextLevelXp} XP)",
  xpGain: '{user} gained {xpGain} XP! ({totalXp}/{nextLevelXp} XP)',
  milestone: '🏆 {user} reached the milestone of Level {level}! Keep going!',
  progressUpdate: '{user} is now Level {level} ({progress}% to next level)',
};

/**
 * Sanitize user input for template
 * Removes potentially dangerous characters
 *
 * @param input User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  // Remove markdown injection attempts
  let sanitized = input.replace(/[*_`~|]/g, '\\$&');

  // Remove newlines to prevent layout issues
  sanitized = sanitized.replace(/\n/g, ' ');

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 100);

  return sanitized;
}

/**
 * Format XP number with commas
 * Example: 1234567 -> "1,234,567"
 *
 * @param xp XP number to format
 * @returns Formatted string
 */
export function formatXP(xp: number): string {
  return xp.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format progress as a progress bar
 * Example: 75% -> "███████▓▓▓"
 *
 * @param progress Progress percentage (0-1)
 * @param length Bar length (default: 10)
 * @returns Progress bar string
 */
export function formatProgressBar(progress: number, length: number = 10): string {
  const filled = Math.round(progress * length);
  const empty = length - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Create an embed description for level-up announcement
 *
 * @param variables Template variables
 * @param includeProgressBar Include visual progress bar
 * @returns Formatted embed description
 */
export function createLevelUpDescription(
  variables: TemplateVariables,
  includeProgressBar: boolean = true
): string {
  let description = `Congratulations! You've reached **Level ${variables.level}**!\n\n`;
  description += `**Total XP:** ${formatXP(variables.totalXp)}\n`;
  description += `**Next Level:** ${formatXP(variables.nextLevelXp)} XP\n`;

  if (includeProgressBar) {
    description += `\n${formatProgressBar(variables.progress)} ${Math.floor(variables.progress * 100)}%`;
  }

  return description;
}

/**
 * Parse template with fallback
 * If template is invalid, returns a default message
 *
 * @param template Template string
 * @param variables Template variables
 * @param fallback Fallback template (default: DEFAULT_TEMPLATES.levelUp)
 * @returns Processed template or fallback
 */
export function parseTemplateWithFallback(
  template: string,
  variables: TemplateVariables,
  fallback: string = DEFAULT_TEMPLATES.levelUp
): string {
  try {
    const validation = validateTemplate(template);
    if (!validation.valid) {
      return parseTemplate(fallback, variables);
    }

    return parseTemplate(template, variables);
  } catch {
    return parseTemplate(fallback, variables);
  }
}
