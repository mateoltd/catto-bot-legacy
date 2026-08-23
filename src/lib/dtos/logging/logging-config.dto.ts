/**
 * DTOs for Logging configuration
 */

import { IsArray, IsString, IsBoolean, IsOptional, ArrayMinSize, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { IsDiscordId, IsDiscordIdArray } from '#lib/validation/decorators/discord.decorators.js';

/**
 * DTO for logging setup request
 */
export class LogSetupDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one log type must be enabled' })
  @IsString({ each: true })
  enabledTypes!: string[];

  @IsString()
  @IsOptional()
  @Length(1, 100, { message: 'Category name must be between 1 and 100 characters' })
  categoryName?: string;
}

/**
 * DTO for updating log configuration
 */
export class UpdateLogConfigDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  enabled?: boolean;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  channelId?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  enabledTypes?: string[];

  @IsArray()
  @IsOptional()
  @IsDiscordIdArray()
  ignoredChannels?: string[];
}

/**
 * DTO for ignored channels in logging
 */
export class IgnoredChannelsDto {
  @IsArray()
  @IsDiscordIdArray()
  channelIds!: string[];
}
