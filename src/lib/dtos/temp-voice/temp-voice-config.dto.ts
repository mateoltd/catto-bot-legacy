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
} from "class-validator";
import { Type } from "class-transformer";
import {
  IsDiscordId,
  IsDiscordIdArray,
} from "#lib/validation/decorators/discord.decorators.js";
import { DEFAULT_TEMP_VOICE_CONFIG } from "#modules/temp-voice/constants.js";

export enum NamingScheme {
  USERNAME = "username",
  DISPLAYNAME = "displayname",
  SEQUENTIAL = "sequential",
  CUSTOM = "custom",
}

export class CreateTempVoiceConfigDto {
  @IsBoolean()
  @Type(() => Boolean)
  enabled: boolean = true;

  @IsArray()
  @ArrayMinSize(1, { message: "At least one join channel is required" })
  @IsDiscordIdArray()
  joinChannelIds!: string[];

  @IsEnum(NamingScheme, {
    message:
      "namingScheme must be username, displayname, sequential, or custom",
  })
  namingScheme: NamingScheme = NamingScheme.USERNAME;

  @IsString()
  @IsOptional()
  @Length(1, 100, {
    message: "customNamingPattern must be between 1 and 100 characters",
  })
  @ValidateIf((o) => o.customNamingPattern !== null)
  customNamingPattern?: string | null;

  @IsNumber()
  @Min(0, { message: "userLimit must be between 0 and 99" })
  @Max(99, { message: "userLimit must be between 0 and 99" })
  @Type(() => Number)
  userLimit: number = 0;

  @IsNumber()
  @Min(8000, { message: "bitrate must be between 8000 and 384000" })
  @Max(384000, { message: "bitrate must be between 8000 and 384000" })
  @IsOptional()
  @Type(() => Number)
  bitrate: number | null = DEFAULT_TEMP_VOICE_CONFIG.defaultBitrate * 1_000;

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

  @IsNumber()
  @Min(0, { message: "deleteEmptyAfterMs must be >= 0" })
  @Max(300000, { message: "deleteEmptyAfterMs must be <= 300000 (5 minutes)" })
  @Type(() => Number)
  deleteEmptyAfterMs: number =
    DEFAULT_TEMP_VOICE_CONFIG.deleteDelaySeconds * 1_000;

  @IsBoolean()
  @Type(() => Boolean)
  controlPanelEnabled: boolean = true;

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
  @Min(1, { message: "maxChannelsPerUser must be between 1 and 10" })
  @Max(10, { message: "maxChannelsPerUser must be between 1 and 10" })
  @Type(() => Number)
  maxChannelsPerUser: number = DEFAULT_TEMP_VOICE_CONFIG.maxChannelsPerUser;

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
  @ArrayMinSize(1, { message: "At least one join channel is required" })
  @IsDiscordIdArray()
  joinChannelIds?: string[];

  @IsEnum(NamingScheme, {
    message:
      "namingScheme must be username, displayname, sequential, or custom",
  })
  @IsOptional()
  namingScheme?: NamingScheme;

  @IsString()
  @IsOptional()
  @Length(1, 100, {
    message: "customNamingPattern must be between 1 and 100 characters",
  })
  @ValidateIf((o) => o.customNamingPattern !== null)
  customNamingPattern?: string | null;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: "userLimit must be between 0 and 99" })
  @Max(99, { message: "userLimit must be between 0 and 99" })
  @Type(() => Number)
  userLimit?: number;

  @IsNumber()
  @IsOptional()
  @Min(8000, { message: "bitrate must be between 8000 and 384000" })
  @Max(384000, { message: "bitrate must be between 8000 and 384000" })
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

  @IsNumber()
  @IsOptional()
  @Min(0, { message: "deleteEmptyAfterMs must be >= 0" })
  @Max(300000, { message: "deleteEmptyAfterMs must be <= 300000 (5 minutes)" })
  @Type(() => Number)
  deleteEmptyAfterMs?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  controlPanelEnabled?: boolean;

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
  @Min(1, { message: "maxChannelsPerUser must be between 1 and 10" })
  @Max(10, { message: "maxChannelsPerUser must be between 1 and 10" })
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
