/**
 * DTOs for Moderation configuration
 */

import { IsBoolean, IsString, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { IsDiscordId } from '#lib/validation/decorators/discord.decorators.js';

/**
 * DTO for updating moderation configuration
 */
export class UpdateModConfigDto {
  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.modLogChannelId !== null)
  modLogChannelId?: string | null;

  @IsString()
  @IsOptional()
  @IsDiscordId()
  @ValidateIf((o) => o.muteRoleId !== null)
  muteRoleId?: string | null;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  autoModEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  watermarkDownloads?: boolean;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.watermarkText !== null)
  watermarkText?: string | null;
}
