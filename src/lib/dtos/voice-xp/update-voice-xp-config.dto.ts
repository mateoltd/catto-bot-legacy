/**
 * DTO for updating Voice XP configuration
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
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDiscordId, IsDiscordIdArray } from '#lib/validation/decorators/discord.decorators.js';

export enum VoiceXPMode {
  PER_MINUTE = 'PER_MINUTE',
  PER_SESSION = 'PER_SESSION',
}

export enum VoiceLevelCurveType {
  FORMULA = 'FORMULA',
  TABLE = 'TABLE',
  // Legacy values kept for backward compatibility (normalized to FORMULA at route layer)
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  LOGARITHMIC = 'LOGARITHMIC',
}

export class UpdateVoiceXPConfigDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  enabled?: boolean;

  // XP Award Settings
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'xpPerMinute must be >= 0' })
  @Max(1000, { message: 'xpPerMinute must be <= 1000' })
  @Type(() => Number)
  xpPerMinute?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'minSessionMinutes must be >= 0' })
  @Max(60, { message: 'minSessionMinutes must be <= 60' })
  @Type(() => Number)
  minSessionMinutes?: number;

  @IsEnum(VoiceXPMode, { message: 'xpMode must be PER_MINUTE or PER_SESSION' })
  @IsOptional()
  xpMode?: VoiceXPMode;

  // Channel Filters
  @IsArray()
  @IsOptional()
  @IsDiscordIdArray()
  allowedChannels?: string[];

  @IsArray()
  @IsOptional()
  @IsDiscordIdArray()
  ignoredChannels?: string[];

  // User State Filters
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  awardMuted?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  awardDeafened?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  awardStreaming?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  awardVideo?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  ignoreAfkChannel?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  antiFarmDampeningEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'antiFarmDampeningMultiplier must be between 0 and 1' })
  @Max(1, { message: 'antiFarmDampeningMultiplier must be between 0 and 1' })
  @Type(() => Number)
  antiFarmDampeningMultiplier?: number;

  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'antiFarmMinimumParticipants must be between 1 and 99' })
  @Max(99, { message: 'antiFarmMinimumParticipants must be between 1 and 99' })
  @Type(() => Number)
  antiFarmMinimumParticipants?: number;

  // Role Filters
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
  @IsEnum(VoiceLevelCurveType, {
    message:
      'levelCurveType must be FORMULA or TABLE (legacy LINEAR/EXPONENTIAL/LOGARITHMIC are accepted)',
  })
  @IsOptional()
  levelCurveType?: VoiceLevelCurveType;

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
  @ArrayMinSize(1, { message: 'tableThresholds must contain at least one value' })
  @Type(() => Number)
  tableThresholds?: number[];
}
