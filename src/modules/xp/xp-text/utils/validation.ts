/**
 * XP Award Validation Rules
 * Checks all filters before awarding XP
 */

import { ValidationContext } from '../types/xp-text.types.js';
import type { GuildXPConfig } from '../types/xp-text.types.js';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  filters: {
    enabled: boolean;
    isBot: boolean;
    isDM: boolean;
    channelAllowed: boolean;
    channelIgnored: boolean;
    roleIgnored: boolean;
    messageLengthValid: boolean;
  };
}

/**
 * Validate if XP should be awarded based on all configured rules
 *
 * @param context Validation context with user/message info
 * @param config Guild XP configuration
 * @returns Validation result with detailed filter breakdown
 */
export function validateXPAward(
  context: ValidationContext,
  config: GuildXPConfig
): ValidationResult {
  const filters = {
    enabled: true,
    isBot: false,
    isDM: false,
    channelAllowed: true,
    channelIgnored: false,
    roleIgnored: false,
    messageLengthValid: true,
  };

  // Check if system is enabled
  if (!config.enabled) {
    filters.enabled = false;
    return {
      valid: false,
      reason: 'XP system is disabled for this guild',
      filters,
    };
  }

  // Check if user is a bot
  if (context.isBot) {
    filters.isBot = true;
    return {
      valid: false,
      reason: 'Bots cannot earn XP',
      filters,
    };
  }

  // Check if message is in DM
  if (context.isDM) {
    filters.isDM = true;
    return {
      valid: false,
      reason: 'XP cannot be earned in DMs',
      filters,
    };
  }

  // Check allowed channels (whitelist)
  if (config.allowedChannels.length > 0) {
    if (!config.allowedChannels.includes(context.channelId)) {
      filters.channelAllowed = false;
      return {
        valid: false,
        reason: 'Channel is not in the allowed channels list',
        filters,
      };
    }
  }

  // Check ignored channels (blacklist)
  if (config.ignoredChannels.includes(context.channelId)) {
    filters.channelIgnored = true;
    return {
      valid: false,
      reason: 'Channel is in the ignored channels list',
      filters,
    };
  }

  // Check ignored roles (blacklist)
  if (config.ignoredRoles.length > 0) {
    const hasIgnoredRole = context.userRoles.some((roleId) => config.ignoredRoles.includes(roleId));

    if (hasIgnoredRole) {
      filters.roleIgnored = true;
      return {
        valid: false,
        reason: 'User has an ignored role',
        filters,
      };
    }
  }

  // Check message length
  if (context.messageContent.length < config.minMessageLength) {
    filters.messageLengthValid = false;
    return {
      valid: false,
      reason: `Message too short (minimum: ${config.minMessageLength} characters)`,
      filters,
    };
  }

  // All checks passed
  return {
    valid: true,
    filters,
  };
}

/**
 * Check if cooldown has passed for a user
 *
 * @param lastAwardAt Last time XP was awarded (null if never)
 * @param cooldownSec Cooldown in seconds
 * @returns Object with passed boolean and remaining seconds
 */
export function checkCooldown(
  lastAwardAt: Date | null,
  cooldownSec: number
): { passed: boolean; remaining: number } {
  if (!lastAwardAt) {
    return { passed: true, remaining: 0 };
  }

  const now = Date.now();
  const lastAward = lastAwardAt.getTime();
  const cooldownMs = cooldownSec * 1000;
  const elapsed = now - lastAward;

  if (elapsed >= cooldownMs) {
    return { passed: true, remaining: 0 };
  }

  const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
  return { passed: false, remaining };
}

/**
 * Check rate limit (max XP per minute)
 * Requires tracking recent XP awards
 *
 * @param recentXpGains Array of { xp, timestamp } from the last minute
 * @param maxXpPerMinute Maximum XP allowed per minute (null = no limit)
 * @returns Object with allowed boolean and current rate
 */
export function checkRateLimit(
  recentXpGains: Array<{ xp: number; timestamp: Date }>,
  maxXpPerMinute: number | null
): { allowed: boolean; currentRate: number } {
  if (maxXpPerMinute === null) {
    return { allowed: true, currentRate: 0 };
  }

  const oneMinuteAgo = Date.now() - 60000;

  // Sum XP gained in the last minute
  const currentRate = recentXpGains
    .filter((gain) => gain.timestamp.getTime() > oneMinuteAgo)
    .reduce((sum, gain) => sum + gain.xp, 0);

  return {
    allowed: currentRate < maxXpPerMinute,
    currentRate,
  };
}

/**
 * Calculate XP amount based on mode
 *
 * @param mode RANDOM or FIXED
 * @param minXp Minimum XP (for RANDOM)
 * @param maxXp Maximum XP (for RANDOM)
 * @param fixedXp Fixed XP amount (for FIXED)
 * @param multiplier Optional multiplier (e.g., from reputation boost)
 * @returns XP amount to award
 */
export function calculateXPAmount(
  mode: 'RANDOM' | 'FIXED',
  minXp: number,
  maxXp: number,
  fixedXp: number,
  multiplier: number = 1.0
): number {
  let baseXP: number;

  if (mode === 'FIXED') {
    baseXP = fixedXp;
  } else {
    // RANDOM mode
    baseXP = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;
  }

  // Apply multiplier and round
  return Math.floor(baseXP * multiplier);
}

/**
 * Validate channel ID format
 *
 * @param channelId Channel ID to validate
 * @returns True if valid Discord snowflake
 */
export function validateChannelId(channelId: string): boolean {
  return /^\d{17,19}$/.test(channelId);
}

/**
 * Validate role ID format
 *
 * @param roleId Role ID to validate
 * @returns True if valid Discord snowflake
 */
export function validateRoleId(roleId: string): boolean {
  return /^\d{17,19}$/.test(roleId);
}

/**
 * Validate user ID format
 *
 * @param userId User ID to validate
 * @returns True if valid Discord snowflake
 */
export function validateUserId(userId: string): boolean {
  return /^\d{17,19}$/.test(userId);
}

/**
 * Validate guild ID format
 *
 * @param guildId Guild ID to validate
 * @returns True if valid Discord snowflake
 */
export function validateGuildId(guildId: string): boolean {
  return /^\d{17,19}$/.test(guildId);
}

/**
 * Batch validate array of IDs
 *
 * @param ids Array of IDs to validate
 * @returns Object with valid boolean and array of invalid IDs
 */
export function validateIds(ids: string[]): { valid: boolean; invalidIds: string[] } {
  const invalidIds = ids.filter((id) => !/^\d{17,19}$/.test(id));

  return {
    valid: invalidIds.length === 0,
    invalidIds,
  };
}
