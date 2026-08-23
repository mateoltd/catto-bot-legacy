/**
 * Custom ID Utilities for Discord Interactions
 *
 * Provides consistent encoding/decoding of custom IDs for buttons, modals, and select menus.
 * Custom IDs are limited to 100 characters in Discord.
 */

export interface ParsedCustomId {
  module: string;
  action: string;
  params: string[];
}

const DELIMITER = ':';

/**
 * Encode a custom ID with module, action, and optional parameters
 * Format: module:action:param1:param2:...
 */
export function encodeCustomId(module: string, action: string, ...params: string[]): string {
  const parts = [module, action, ...params];
  const customId = parts.join(DELIMITER);

  if (customId.length > 100) {
    throw new Error(`Custom ID exceeds 100 character limit: ${customId.length} characters`);
  }

  return customId;
}

/**
 * Decode a custom ID into its component parts
 */
export function decodeCustomId(customId: string): ParsedCustomId {
  const parts = customId.split(DELIMITER);
  const module = parts[0];
  const action = parts[1];

  if (!module || !action) {
    throw new Error(`Invalid custom ID format: ${customId}`);
  }

  return {
    module,
    action,
    params: parts.slice(2),
  };
}

/**
 * Check if a custom ID matches a specific module and action
 */
export function matchesCustomId(customId: string, module: string, action?: string): boolean {
  const parsed = decodeCustomId(customId);
  if (parsed.module !== module) return false;
  if (action && parsed.action !== action) return false;
  return true;
}

/**
 * Extract the first parameter from a custom ID
 */
export function extractFirstParam(customId: string): string | undefined {
  return decodeCustomId(customId).params[0];
}

/**
 * Extract all parameters from a custom ID
 */
export function extractParams(customId: string): string[] {
  return decodeCustomId(customId).params;
}

/**
 * Create a custom ID with a nonce for uniqueness
 */
export function encodeWithNonce(module: string, action: string, ...params: string[]): string {
  const nonce = Math.random().toString(36).substring(2, 8);
  return encodeCustomId(module, action, ...params, nonce);
}

/**
 * Strip the nonce from a custom ID (assumes nonce is the last param)
 */
export function stripNonce(customId: string): string {
  const parsed = decodeCustomId(customId);
  const paramsWithoutNonce = parsed.params.slice(0, -1);
  return encodeCustomId(parsed.module, parsed.action, ...paramsWithoutNonce);
}

/**
 * Validate that a custom ID is well-formed
 */
export function isValidCustomId(customId: string): boolean {
  if (!customId || customId.length > 100) return false;
  try {
    const parsed = decodeCustomId(customId);
    return parsed.module.length > 0 && parsed.action.length > 0;
  } catch {
    return false;
  }
}

/**
 * Sanitize a string for use in custom IDs
 */
export function sanitizeForCustomId(value: string): string {
  return value.replace(new RegExp(DELIMITER, 'g'), '_');
}
