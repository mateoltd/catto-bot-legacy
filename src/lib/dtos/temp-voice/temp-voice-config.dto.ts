/**
 * DTOs for Temp Voice configuration
 * Replaces Zod schemas from modules
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
  ArrayMinSize,
  Length,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDiscordId, IsDiscordIdArray } from '#lib/validation/decorators/discord.decorators.js';
import { OwnerLeaveStrategy } from '#modules/temp-voice/constants.js';

export enum NamingScheme {
  USERNAME = 'username',
  DISPLAYNAME = 'displayname',
  SEQUENTIAL = 'sequential',
  CUSTOM = 'custom',
}

export class CreateTempVoiceConfigDto {
  @IsBoolean()
  @Type(() => Boolean)
  enabled: boolean = true;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one join channel is required' })
  @IsDiscordIdArray()
  joinChannelIds!: string[];

  @IsEnum(NamingScheme, {
    message: 'namingScheme must be username, displayname, sequential, or custom',
  })
  namingScheme: NamingScheme = NamingScheme.USERNAME;

  @IsString()
  @IsOptional()
  @Length(1, 100, { message: 'customNamingPattern must be between 1 and 100 characters' })
  @ValidateIf((o) => o.customNamingPattern !== null)
  customNamingPattern?: string | null;

  @IsNumber()
  @Min(0, { message: 'userLimit must be between 0 and 99' })
  @Max(99, { message: 'userLimit must be between 0 and 99' })
  @Type(() => Number)
  userLimit: number = 0;

  @IsNumber()
  @Min(8000, { message: 'bitrate must be between 8000 and 384000' })
  @Max(384000, { message: 'bitrate must be between 8000 and 384000' })
  @Type(() => Number)
  bitrate: number = 64000;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.defaultCategoryId !== null)
  defaultCategoryId?: string | null;

  @IsBoolean()
  @Type(() => Boolean)
  defaultLocked: boolean = false;

  @IsBoolean()
  @Type(() => Boolean)
  defaultHidden: boolean = false;

  @IsEnum(OwnerLeaveStrategy, {
    message: 'ownerLeaveStrategy must be TRANSFER, KEEP, or DELETE',
  })
  ownerLeaveStrategy: OwnerLeaveStrategy = OwnerLeaveStrategy.TRANSFER;

  @IsBoolean()
  @Type(() => Boolean)
  autoDeleteEmpty: boolean = true;

  @IsNumber()
  @Min(0, { message: 'deleteEmptyAfterMs must be >= 0' })
  @Max(300000, { message: 'deleteEmptyAfterMs must be <= 300000 (5 minutes)' })
  @Type(() => Number)
  deleteEmptyAfterMs: number = 60000;

  @IsBoolean()
  @Type(() => Boolean)
  autoDeleteOwnerLeave: boolean = true;

  @IsNumber()
  @Min(0, { message: 'deleteOwnerLeaveAfterMs must be >= 0' })
  @Type(() => Number)
  deleteOwnerLeaveAfterMs: number = 60000;

  @IsBoolean()
  @Type(() => Boolean)
  allowOwnerTransfer: boolean = true;

  @IsBoolean()
  @Type(() => Boolean)
  allowOwnerManagement: boolean = true;

  @IsBoolean()
  @Type(() => Boolean)
  enableNameModeration: boolean = false;

  @IsArray()
  @IsString({ each: true })
  blockedKeywords: string[] = [];

  @IsNumber()
  @Min(1, { message: 'maxChannelsPerUser must be between 1 and 10' })
  @Max(10, { message: 'maxChannelsPerUser must be between 1 and 10' })
  @Type(() => Number)
  maxChannelsPerUser: number = 1;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.logChannelId !== null)
  logChannelId?: string | null;
}

/**
 * DTO for partial updates to temp voice config
 * All fields optional for PATCH operations
 */
export class UpdateTempVoiceConfigDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  enabled?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1, { message: 'At least one join channel is required' })
  @IsDiscordIdArray()
  joinChannelIds?: string[];

  @IsEnum(NamingScheme, {
    message: 'namingScheme must be username, displayname, sequential, or custom',
  })
  @IsOptional()
  namingScheme?: NamingScheme;

  @IsString()
  @IsOptional()
  @Length(1, 100, { message: 'customNamingPattern must be between 1 and 100 characters' })
  @ValidateIf((o) => o.customNamingPattern !== null)
  customNamingPattern?: string | null;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'userLimit must be between 0 and 99' })
  @Max(99, { message: 'userLimit must be between 0 and 99' })
  @Type(() => Number)
  userLimit?: number;

  @IsNumber()
  @IsOptional()
  @Min(8000, { message: 'bitrate must be between 8000 and 384000' })
  @Max(384000, { message: 'bitrate must be between 8000 and 384000' })
  @Type(() => Number)
  bitrate?: number;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.defaultCategoryId !== null)
  defaultCategoryId?: string | null;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  defaultLocked?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  defaultHidden?: boolean;

  @IsEnum(OwnerLeaveStrategy, {
    message: 'ownerLeaveStrategy must be TRANSFER, KEEP, or DELETE',
  })
  @IsOptional()
  ownerLeaveStrategy?: OwnerLeaveStrategy;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  autoDeleteEmpty?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'deleteEmptyAfterMs must be >= 0' })
  @Max(300000, { message: 'deleteEmptyAfterMs must be <= 300000 (5 minutes)' })
  @Type(() => Number)
  deleteEmptyAfterMs?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  autoDeleteOwnerLeave?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'deleteOwnerLeaveAfterMs must be >= 0' })
  @Type(() => Number)
  deleteOwnerLeaveAfterMs?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  allowOwnerTransfer?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  allowOwnerManagement?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  enableNameModeration?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  blockedKeywords?: string[];

  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'maxChannelsPerUser must be between 1 and 10' })
  @Max(10, { message: 'maxChannelsPerUser must be between 1 and 10' })
  @Type(() => Number)
  maxChannelsPerUser?: number;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.logChannelId !== null)
  logChannelId?: string | null;
}

/**
 * DTO for adding a join channel
 */
export class AddJoinChannelDto {
  @IsString()
  @IsDiscordId()
  channelId!: string;
}
