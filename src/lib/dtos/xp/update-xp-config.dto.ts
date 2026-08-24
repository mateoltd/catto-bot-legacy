/**
 * DTO for updating Text XP configuration
 * Replaces the custom validation function from modules
 */

import {
  IsBoolean,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  Min,
  Max,
  Length,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDiscordId, IsDiscordIdArray } from '#lib/validation/decorators/discord.decorators.js';
import { HasThresholdsForTableCurve } from '#lib/validation/decorators/xp.decorators.js';

export enum XPMode {
  RANDOM = 'RANDOM',
  FIXED = 'FIXED',
}

export enum LevelCurveType {
  FORMULA = 'FORMULA',
  TABLE = 'TABLE',
  // Legacy values kept for backward compatibility (normalized to FORMULA at route layer)
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  LOGARITHMIC = 'LOGARITHMIC',
}

export class UpdateXPConfigDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  enabled?: boolean;

  // XP Award Settings
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'cooldownSec must be >= 0' })
  @Max(3600, { message: 'cooldownSec must be <= 3600 (1 hour)' })
  @Type(() => Number)
  cooldownSec?: number;

  @IsEnum(XPMode, { message: 'xpMode must be RANDOM or FIXED' })
  @IsOptional()
  xpMode?: XPMode;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'minXp must be >= 0' })
  @Type(() => Number)
  minXp?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'maxXp must be >= 0' })
  @Type(() => Number)
  maxXp?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'fixedXp must be >= 0' })
  @Type(() => Number)
  fixedXp?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'minMessageLength must be >= 0' })
  @Max(2000, { message: 'minMessageLength must be <= 2000' })
  @Type(() => Number)
  minMessageLength?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'maxXpPerMinute must be >= 0' })
  @Type(() => Number)
  @ValidateIf((o) => o.maxXpPerMinute !== null)
  maxXpPerMinute?: number | null;

  // Channel & Role Filters
  @IsArray()
  @IsOptional()
  @IsDiscordIdArray()
  allowedChannels?: string[];

  @IsArray()
  @IsOptional()
  @IsDiscordIdArray()
  ignoredChannels?: string[];

  @IsArray()
  @IsOptional()
  @IsDiscordIdArray()
  ignoredRoles?: string[];

  // Level-Up Announcements
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  announceLevelUp?: boolean;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.announceChannelId !== null)
  announceChannelId?: string | null;

  @IsString()
  @IsOptional()
  @Length(1, 2000, { message: 'messageTemplate must be between 1 and 2000 characters' })
  messageTemplate?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  embedEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'embedColor must be between 0 and 16777215' })
  @Max(16777215, { message: 'embedColor must be between 0 and 16777215 (0xFFFFFF)' })
  @Type(() => Number)
  embedColor?: number;

  // Level Curve Configuration
  @IsEnum(LevelCurveType, {
    message:
      'levelCurveType must be FORMULA or TABLE (legacy LINEAR/EXPONENTIAL/LOGARITHMIC are accepted)',
  })
  @IsOptional()
  levelCurveType?: LevelCurveType;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'formulaBase must be >= 0' })
  @Type(() => Number)
  formulaBase?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'formulaExponent must be >= 0' })
  @Type(() => Number)
  formulaExponent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'formulaOffset must be >= 0' })
  @Type(() => Number)
  formulaOffset?: number;

  @IsArray()
  @IsOptional()
  @HasThresholdsForTableCurve()
  @Type(() => Number)
  tableThresholds?: number[];
}
