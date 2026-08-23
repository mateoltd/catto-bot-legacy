/**
 * DTO for updating XP configuration
 */

import { XPMode, LevelCurveType } from '../types/xp-text.types.js';

export interface UpdateXPConfigDTO {
  enabled?: boolean;

  // XP Award Settings
  cooldownSec?: number;
  xpMode?: XPMode;
  minXp?: number;
  maxXp?: number;
  fixedXp?: number;
  minMessageLength?: number;
  maxXpPerMinute?: number | null;

  // Channel & Role Filters
  allowedChannels?: string[];
  ignoredChannels?: string[];
  ignoredRoles?: string[];

  // Level-Up Announcements
  announceLevelUp?: boolean;
  announceChannelId?: string | null;
  messageTemplate?: string;
  embedEnabled?: boolean;
  embedColor?: number;

  // Level Curve Configuration
  levelCurveType?: LevelCurveType;
  formulaBase?: number;
  formulaExponent?: number;
  formulaOffset?: number;
  tableThresholds?: number[];
}

// Validation helper
export function validateUpdateXPConfig(dto: UpdateXPConfigDTO): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate cooldown
  if (dto.cooldownSec !== undefined) {
    if (dto.cooldownSec < 0) {
      errors.push('cooldownSec must be >= 0');
    }
    if (dto.cooldownSec > 3600) {
      errors.push('cooldownSec must be <= 3600 (1 hour)');
    }
  }

  // Validate XP values
  if (dto.minXp !== undefined && dto.minXp < 0) {
    errors.push('minXp must be >= 0');
  }

  if (dto.maxXp !== undefined && dto.maxXp < 0) {
    errors.push('maxXp must be >= 0');
  }

  if (dto.minXp !== undefined && dto.maxXp !== undefined && dto.minXp > dto.maxXp) {
    errors.push('minXp must be <= maxXp');
  }

  if (dto.fixedXp !== undefined && dto.fixedXp < 0) {
    errors.push('fixedXp must be >= 0');
  }

  // Validate message length
  if (dto.minMessageLength !== undefined) {
    if (dto.minMessageLength < 0) {
      errors.push('minMessageLength must be >= 0');
    }
    if (dto.minMessageLength > 2000) {
      errors.push('minMessageLength must be <= 2000');
    }
  }

  // Validate max XP per minute
  if (dto.maxXpPerMinute !== undefined && dto.maxXpPerMinute !== null && dto.maxXpPerMinute < 0) {
    errors.push('maxXpPerMinute must be >= 0');
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
    }
    if (dto.messageTemplate.length === 0) {
      errors.push('messageTemplate cannot be empty');
    }
    if (dto.messageTemplate.length > 2000) {
      errors.push('messageTemplate must be <= 2000 characters');
    }
  }

  // Validate embed color
  if (dto.embedColor !== undefined) {
    if (dto.embedColor < 0 || dto.embedColor > 16777215) {
      errors.push('embedColor must be between 0 and 16777215 (0xFFFFFF)');
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

  // Validate table thresholds
  if (dto.tableThresholds !== undefined) {
    if (!Array.isArray(dto.tableThresholds)) {
      errors.push('tableThresholds must be an array');
    } else {
      // Check all values are positive integers
      for (let i = 0; i < dto.tableThresholds.length; i++) {
        const value = dto.tableThresholds[i];
        if (value === undefined || !Number.isInteger(value) || value < 0) {
          errors.push(`tableThresholds[${i}] must be a positive integer`);
          break;
        }
      }

      // Check ascending order
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
  if (dto.xpMode !== undefined && !Object.values(XPMode).includes(dto.xpMode)) {
    errors.push(`xpMode must be one of: ${Object.values(XPMode).join(', ')}`);
  }

  if (
    dto.levelCurveType !== undefined &&
    !Object.values(LevelCurveType).includes(dto.levelCurveType)
  ) {
    errors.push(`levelCurveType must be one of: ${Object.values(LevelCurveType).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
