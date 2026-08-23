/**
 * Utility functions
 *
 * Re-exports embed builders from the shared Discord library and provides
 * additional utility functions.
 */

import { ValidationError } from './validation/zod.js';

// Re-export embed builders from shared Discord library
export { buildSuccessEmbed, buildErrorEmbed, buildInfoEmbed } from '#lib/discord/index.js';

/**
 * Formats uptime into a readable string
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || '0s';
}

/**
 * Ensures a value is not null or undefined
 *
 * @param value - The value to check
 * @param context - Optional context for the error message (e.g., variable name or description)
 * @throws {ValidationError} if the value is null or undefined
 * @example
 * ```ts
 * const value = ensureNonNull(null); // throws ValidationError: "Value is null or undefined"
 * const value = ensureNonNull(undefined, 'userId'); // throws ValidationError: "userId is null or undefined"
 * const value = ensureNonNull('hello'); // returns 'hello'
 * ```
 */
export function ensureNonNull<T>(value: T | null | undefined, context?: string): T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      context ? `${context} is null or undefined` : 'Value is null or undefined'
    );
  }
  return value;
}
