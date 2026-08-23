/**
 * Voice XP Validation Rules
 */

import type { GuildVoiceXPConfig } from '@prisma/client';
import type { VoiceValidationContext } from '../types/voice-xp.types.js';

export interface VoiceValidationResult {
  valid: boolean;
  reason?: string;
  filters: {
    enabled: boolean;
    channelAllowed: boolean;
    channelIgnored: boolean;
    roleIgnored: boolean;
    mutedAllowed: boolean;
    deafenedAllowed: boolean;
    afkChannel: boolean;
  };
}

/**
 * Validate if voice XP should be awarded
 */
export function validateVoiceXPAward(
  context: VoiceValidationContext,
  config: GuildVoiceXPConfig
): VoiceValidationResult {
  const filters = {
    enabled: true,
    channelAllowed: true,
    channelIgnored: false,
    roleIgnored: false,
    mutedAllowed: true,
    deafenedAllowed: true,
    afkChannel: false,
  };

  // Check if system is enabled
  if (!config.enabled) {
    filters.enabled = false;
    return {
      valid: false,
      reason: 'Voice XP system is disabled',
      filters,
    };
  }

  // Check AFK channel
  if (context.isAfkChannel && config.ignoreAfkChannel) {
    filters.afkChannel = true;
    return {
      valid: false,
      reason: 'User is in AFK channel',
      filters,
    };
  }

  // Check allowed channels (if specified)
  if (config.allowedChannels.length > 0) {
    if (!config.allowedChannels.includes(context.channelId)) {
      filters.channelAllowed = false;
      return {
        valid: false,
        reason: 'Channel not in allowed list',
        filters,
      };
    }
  }

  // Check ignored channels
  if (config.ignoredChannels.includes(context.channelId)) {
    filters.channelIgnored = true;
    return {
      valid: false,
      reason: 'Channel is ignored',
      filters,
    };
  }

  // Check ignored roles
  const hasIgnoredRole = context.userRoles.some((roleId) => config.ignoredRoles.includes(roleId));
  if (hasIgnoredRole) {
    filters.roleIgnored = true;
    return {
      valid: false,
      reason: 'User has ignored role',
      filters,
    };
  }

  // Check muted status
  if (context.isMuted && !config.awardMuted) {
    filters.mutedAllowed = false;
    return {
      valid: false,
      reason: 'User is muted',
      filters,
    };
  }

  // Check deafened status
  if (context.isDeafened && !config.awardDeafened) {
    filters.deafenedAllowed = false;
    return {
      valid: false,
      reason: 'User is deafened',
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
 * Calculate XP amount for session
 */
export function calculateSessionXP(
  durationMinutes: number,
  xpPerMinute: number,
  multiplier: number = 1.0
): number {
  return Math.floor(durationMinutes * xpPerMinute * multiplier);
}
