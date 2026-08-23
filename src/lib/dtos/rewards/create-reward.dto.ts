/**
 * DTO for creating a new reward
 */

import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsObject,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { XPType, RewardType } from '#lib/types/rewards.types.js';

export class CreateRewardDto {
  @IsNumber()
  @Min(1, { message: 'Level must be at least 1' })
  @Max(1000, { message: 'Level must be at most 1000' })
  @Type(() => Number)
  level!: number;

  @IsEnum(XPType, { message: 'xpType must be TEXT, VOICE, or BOTH' })
  xpType!: XPType;

  @IsEnum(RewardType, { message: 'rewardType must be ROLE, BADGE, PERMISSION, or CUSTOM' })
  rewardType!: RewardType;

  @IsString()
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters' })
  name!: string;

  @IsString()
  @IsOptional()
  @Length(0, 500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  oneTime?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  stackable?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  requiresPrevious?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Priority must be at least 0' })
  @Type(() => Number)
  priority?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  enabled?: boolean;

  @IsObject({ message: 'rewardData must be an object' })
  rewardData!: Record<string, unknown>;
}
