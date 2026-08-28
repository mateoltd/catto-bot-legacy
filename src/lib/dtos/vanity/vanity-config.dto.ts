import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsString, MaxLength, ValidateIf } from 'class-validator';
import { IsDiscordId } from '#lib/validation/decorators/discord.decorators.js';

export class UpdateVanityConfigDto {
  @IsDefined()
  @IsBoolean()
  @Type(() => Boolean)
  enabled!: boolean;

  @IsDefined()
  @IsString()
  @MaxLength(128)
  keyword!: string;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsDiscordId()
  roleId!: string | null;

  @IsDefined()
  @IsBoolean()
  @Type(() => Boolean)
  thankYouEnabled!: boolean;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsDiscordId()
  thankYouChannelId!: string | null;

  @IsDefined()
  @IsString()
  @MaxLength(1500)
  thankYouMessage!: string;
}
