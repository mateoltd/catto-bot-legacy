/**
 * DTOs for Permission management
 */

import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { IsDiscordId } from '#lib/validation/decorators/discord.decorators.js';

// Import Prisma enums
import type {
  PermissionSubjectType,
  PermissionResourceType,
  PermissionEffect,
} from '@prisma/client';

/**
 * DTO for creating a permission grant
 */
export class CreatePermissionGrantDto {
  @IsEnum(['USER', 'ROLE'], { message: 'subjectType must be USER or ROLE' })
  subjectType!: PermissionSubjectType;

  @IsString()
  @IsDiscordId()
  subjectId!: string;

  @IsEnum(['COMMAND', 'MODULE', 'ACTION'], {
    message: 'resourceType must be COMMAND, MODULE, or ACTION',
  })
  resourceType!: PermissionResourceType;

  @IsString()
  @MinLength(1, { message: 'resourceKey must not be empty' })
  resourceKey!: string;

  @IsEnum(['ALLOW', 'DENY'], { message: 'effect must be ALLOW or DENY' })
  effect!: PermissionEffect;

  @IsString()
  @IsDiscordId()
  @IsOptional()
  createdById?: string;
}

/**
 * DTO for filtering permission grants (query params)
 */
export class PermissionFilterDto {
  @IsEnum(['USER', 'ROLE'], { message: 'subjectType must be USER or ROLE' })
  @IsOptional()
  subjectType?: PermissionSubjectType;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsEnum(['COMMAND', 'MODULE', 'ACTION'], {
    message: 'resourceType must be COMMAND, MODULE, or ACTION',
  })
  @IsOptional()
  resourceType?: PermissionResourceType;

  @IsString()
  @IsOptional()
  resourceKey?: string;
}
