/**
 * DTO for previewing XP award calculations
 * Useful for testing/debugging XP calculations without awarding
 */

export interface AwardPreviewDTO {
  guildId: string;
  userId: string;
  channelId?: string;
  messageLength?: number;
  userRoles?: string[];
}

export interface AwardPreviewResponse {
  wouldAward: boolean;
  reason: string;
  xpAmount?: number;
  cooldownRemaining?: number;
  filters: {
    enabled: boolean;
    channelAllowed: boolean;
    channelIgnored: boolean;
    roleIgnored: boolean;
    messageLengthValid: boolean;
    cooldownPassed: boolean;
    rateLimitPassed: boolean;
  };
  config: {
    enabled: boolean;
    cooldownSec: number;
    xpMode: string;
    minXp: number;
    maxXp: number;
    fixedXp: number;
    minMessageLength: number;
  };
}

// Validation helper
export function validateAwardPreview(dto: AwardPreviewDTO): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!dto.guildId || typeof dto.guildId !== 'string') {
    errors.push('guildId is required and must be a string');
  }

  if (!dto.userId || typeof dto.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (dto.messageLength !== undefined && (dto.messageLength < 0 || dto.messageLength > 2000)) {
    errors.push('messageLength must be between 0 and 2000');
  }

  if (dto.userRoles !== undefined && !Array.isArray(dto.userRoles)) {
    errors.push('userRoles must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
