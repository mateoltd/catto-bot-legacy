/**
 * DTO for updating Voice XP configuration
 */

import { VoiceXPMode, VoiceLevelCurveType } from '../types/voice-xp.types.js';

export interface UpdateVoiceXPConfigDTO {
  enabled?: boolean;

  // XP Award Settings
  xpPerMinute?: number;
  minSessionMinutes?: number;
  xpMode?: VoiceXPMode;

  // Channel Filters
  allowedChannels?: string[];
  ignoredChannels?: string[];

  // User State Filters
  awardMuted?: boolean;
  awardDeafened?: boolean;
  awardStreaming?: boolean;
  awardVideo?: boolean;
  ignoreAfkChannel?: boolean;
  antiFarmDampeningEnabled?: boolean;
  antiFarmDampeningMultiplier?: number;
  antiFarmMinimumParticipants?: number;

  // Role Filters
  ignoredRoles?: string[];

  // Level-Up Announcements
  announceLevelUp?: boolean;
  announceChannelId?: string | null;
  messageTemplate?: string;
  embedEnabled?: boolean;
  embedColor?: number;

  // Level Curve Configuration
  levelCurveType?: VoiceLevelCurveType;
  formulaBase?: number;
  formulaExponent?: number;
  formulaOffset?: number;
  tableThresholds?: number[];
}

export function validateUpdateVoiceXPConfig(dto: UpdateVoiceXPConfigDTO): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate XP per minute
  if (dto.xpPerMinute !== undefined) {
    if (dto.xpPerMinute < 0) {
      errors.push('xpPerMinute must be >= 0');
    }
    if (dto.xpPerMinute > 1000) {
      errors.push('xpPerMinute must be <= 1000');
    }
  }

  // Validate min session minutes
  if (dto.minSessionMinutes !== undefined) {
    if (dto.minSessionMinutes < 0) {
      errors.push('minSessionMinutes must be >= 0');
    }
    if (dto.minSessionMinutes > 60) {
      errors.push('minSessionMinutes must be <= 60');
    }
  }

  // Validate arrays
  if (dto.allowedChannels !== undefined && !Array.isArray(dto.allowedChannels)) {
    errors.push('allowedChannels must be an array');
  }

  if (dto.ignoredChannels !== undefined && !Array.isArray(dto.ignoredChannels)) {
    errors.push('ignoredChannels must be an array');
  }

  if (dto.ignoredRoles !== undefined && !Array.isArray(dto.ignoredRoles)) {
    errors.push('ignoredRoles must be an array');
  }

  // Validate message template
  if (dto.messageTemplate !== undefined) {
    if (typeof dto.messageTemplate !== 'string') {
      errors.push('messageTemplate must be a string');
    } else if (dto.messageTemplate.length === 0) {
      errors.push('messageTemplate cannot be empty');
    } else if (dto.messageTemplate.length > 2000) {
      errors.push('messageTemplate must be <= 2000 characters');
    }
  }

  // Validate embed color
  if (dto.embedColor !== undefined) {
    if (dto.embedColor < 0 || dto.embedColor > 16777215) {
      errors.push('embedColor must be between 0 and 16777215');
    }
  }

  // Validate formula values
  if (dto.formulaBase !== undefined && dto.formulaBase < 0) {
    errors.push('formulaBase must be >= 0');
  }

  if (dto.formulaExponent !== undefined && dto.formulaExponent < 0) {
    errors.push('formulaExponent must be >= 0');
  }

  if (dto.formulaOffset !== undefined && dto.formulaOffset < 0) {
    errors.push('formulaOffset must be >= 0');
  }

  if (dto.antiFarmDampeningMultiplier !== undefined) {
    if (dto.antiFarmDampeningMultiplier < 0 || dto.antiFarmDampeningMultiplier > 1) {
      errors.push('antiFarmDampeningMultiplier must be between 0 and 1');
    }
  }

  if (dto.antiFarmMinimumParticipants !== undefined) {
    if (!Number.isInteger(dto.antiFarmMinimumParticipants)) {
      errors.push('antiFarmMinimumParticipants must be an integer');
    } else if (dto.antiFarmMinimumParticipants < 1 || dto.antiFarmMinimumParticipants > 99) {
      errors.push('antiFarmMinimumParticipants must be between 1 and 99');
    }
  }

  // Validate table thresholds
  if (dto.tableThresholds !== undefined) {
    if (!Array.isArray(dto.tableThresholds)) {
      errors.push('tableThresholds must be an array');
    } else {
      for (let i = 0; i < dto.tableThresholds.length; i++) {
        const value = dto.tableThresholds[i];
        if (value === undefined || !Number.isInteger(value) || value < 0) {
          errors.push(`tableThresholds[${i}] must be a positive integer`);
          break;
        }
      }

      for (let i = 1; i < dto.tableThresholds.length; i++) {
        const current = dto.tableThresholds[i];
        const previous = dto.tableThresholds[i - 1];
        if (current === undefined || previous === undefined || current <= previous) {
          errors.push('tableThresholds must be in ascending order');
          break;
        }
      }
    }
  }

  // Validate enums
  if (dto.xpMode !== undefined && !Object.values(VoiceXPMode).includes(dto.xpMode)) {
    errors.push(`xpMode must be one of: ${Object.values(VoiceXPMode).join(', ')}`);
  }

  if (
    dto.levelCurveType !== undefined &&
    !Object.values(VoiceLevelCurveType).includes(dto.levelCurveType)
  ) {
    errors.push(`levelCurveType must be one of: ${Object.values(VoiceLevelCurveType).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
