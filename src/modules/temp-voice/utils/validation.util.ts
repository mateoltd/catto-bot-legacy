/**
 * Validation schemas and utilities using Zod
 */

import { z } from 'zod';
import { TEMP_VOICE_LIMITS, OwnerLeaveStrategy, VOICE_REGIONS } from '../constants.js';

/**
 * Zod schema for validating temp voice configuration
 */
export const tempVoiceConfigSchema = z.object({
  enabled: z.boolean().optional(),

  joinToCreateChannels: z
    .array(z.string().regex(/^\d{17,19}$/, 'Invalid Discord channel ID'))
    .optional(),

  categoryId: z
    .string()
    .regex(/^\d{17,19}$/, 'Invalid Discord channel ID')
    .nullable()
    .optional(),

  fallbackCategoryId: z
    .string()
    .regex(/^\d{17,19}$/, 'Invalid Discord channel ID')
    .nullable()
    .optional(),

  defaultNameTemplate: z
    .string()
    .min(1, 'Template cannot be empty')
    .max(
      TEMP_VOICE_LIMITS.MAX_TEMPLATE_LENGTH,
      `Template must be ${TEMP_VOICE_LIMITS.MAX_TEMPLATE_LENGTH} characters or less`
    )
    .optional(),

  defaultUserLimit: z
    .number()
    .int()
    .min(
      TEMP_VOICE_LIMITS.MIN_USER_LIMIT,
      `User limit must be at least ${TEMP_VOICE_LIMITS.MIN_USER_LIMIT}`
    )
    .max(
      TEMP_VOICE_LIMITS.MAX_USER_LIMIT,
      `User limit cannot exceed ${TEMP_VOICE_LIMITS.MAX_USER_LIMIT}`
    )
    .optional(),

  defaultBitrate: z
    .number()
    .int()
    .min(
      TEMP_VOICE_LIMITS.MIN_BITRATE,
      `Bitrate must be at least ${TEMP_VOICE_LIMITS.MIN_BITRATE} kbps`
    )
    .max(
      TEMP_VOICE_LIMITS.MAX_BITRATE,
      `Bitrate cannot exceed ${TEMP_VOICE_LIMITS.MAX_BITRATE} kbps`
    )
    .nullable()
    .optional(),

  defaultRegion: z
    .enum([...VOICE_REGIONS] as [string, ...string[]])
    .nullable()
    .optional(),

  defaultLocked: z.boolean().optional(),

  defaultHidden: z.boolean().optional(),

  deleteDelaySeconds: z
    .number()
    .int()
    .min(
      TEMP_VOICE_LIMITS.MIN_DELETE_DELAY,
      `Delete delay must be at least ${TEMP_VOICE_LIMITS.MIN_DELETE_DELAY} seconds`
    )
    .max(
      TEMP_VOICE_LIMITS.MAX_DELETE_DELAY,
      `Delete delay cannot exceed ${TEMP_VOICE_LIMITS.MAX_DELETE_DELAY} seconds`
    )
    .optional(),

  ownerLeaveStrategy: z
    .enum([OwnerLeaveStrategy.TRANSFER, OwnerLeaveStrategy.KEEP, OwnerLeaveStrategy.DELETE])
    .optional(),

  cooldownSeconds: z
    .number()
    .int()
    .min(
      TEMP_VOICE_LIMITS.MIN_COOLDOWN,
      `Cooldown must be at least ${TEMP_VOICE_LIMITS.MIN_COOLDOWN} seconds`
    )
    .max(
      TEMP_VOICE_LIMITS.MAX_COOLDOWN,
      `Cooldown cannot exceed ${TEMP_VOICE_LIMITS.MAX_COOLDOWN} seconds`
    )
    .optional(),

  maxChannelsPerUser: z
    .number()
    .int()
    .min(
      TEMP_VOICE_LIMITS.MIN_CHANNELS_PER_USER,
      `Max channels per user must be at least ${TEMP_VOICE_LIMITS.MIN_CHANNELS_PER_USER}`
    )
    .max(
      TEMP_VOICE_LIMITS.MAX_CHANNELS_PER_USER,
      `Max channels per user cannot exceed ${TEMP_VOICE_LIMITS.MAX_CHANNELS_PER_USER}`
    )
    .optional(),

  controlPanelEnabled: z.boolean().optional(),

  controlPanelOnCreate: z.boolean().optional(),

  logChannelId: z
    .string()
    .regex(/^\d{17,19}$/, 'Invalid Discord channel ID')
    .nullable()
    .optional(),

  adminRoleIds: z.array(z.string().regex(/^\d{17,19}$/, 'Invalid Discord role ID')).optional(),
});

/**
 * Type inferred from the Zod schema
 */
export type TempVoiceConfigValidation = z.infer<typeof tempVoiceConfigSchema>;

/**
 * Schema for validating channel ID additions
 */
export const addJoinChannelSchema = z.object({
  channelId: z.string().regex(/^\d{17,19}$/, 'Invalid Discord channel ID'),
});

/**
 * Schema for validating channel updates
 */
export const updateTempChannelSchema = z.object({
  customName: z
    .string()
    .min(1, 'Channel name cannot be empty')
    .max(100, 'Channel name must be 100 characters or less')
    .optional(),

  customUserLimit: z
    .number()
    .int()
    .min(0, 'User limit must be at least 0')
    .max(99, 'User limit cannot exceed 99')
    .optional(),

  customBitrate: z
    .number()
    .int()
    .min(8, 'Bitrate must be at least 8 kbps')
    .max(384, 'Bitrate cannot exceed 384 kbps')
    .optional(),

  customRegion: z.enum([...VOICE_REGIONS] as [string, ...string[]]).optional(),

  isLocked: z.boolean().optional(),

  isHidden: z.boolean().optional(),
});

/**
 * Schema for query parameters
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),

  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0)),

  ownerId: z
    .string()
    .regex(/^\d{17,19}$/, 'Invalid Discord user ID')
    .optional(),
});

/**
 * Validate configuration input
 */
export function validateConfig(data: unknown) {
  return tempVoiceConfigSchema.parse(data);
}

/**
 * Validate configuration input and return result with errors
 */
export function validateConfigSafe(data: unknown) {
  return tempVoiceConfigSchema.safeParse(data);
}

/**
 * Validate channel ID
 */
export function validateAddJoinChannel(data: unknown) {
  return addJoinChannelSchema.parse(data);
}

/**
 * Validate channel update
 */
export function validateChannelUpdate(data: unknown) {
  return updateTempChannelSchema.parse(data);
}

/**
 * Validate pagination parameters
 */
export function validatePagination(query: Record<string, unknown>) {
  return paginationSchema.parse(query);
}

/**
 * Convert Zod errors to API error details
 */
export function zodErrorToApiDetails(error: z.ZodError) {
  return error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    value: err.code,
  }));
}

/**
 * Check if a string is a valid Discord snowflake ID
 */
export function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Validate that a template string contains valid variables
 */
export function validateTemplateVariables(template: string): {
  valid: boolean;
  invalidVariables?: string[];
} {
  const validVariables = ['{username}', '{discriminator}', '{tag}', '{n}'];
  const foundVariables = template.match(/\{[^}]+\}/g) || [];

  const invalidVariables = foundVariables.filter((v) => !validVariables.includes(v));

  return {
    valid: invalidVariables.length === 0,
    invalidVariables: invalidVariables.length > 0 ? invalidVariables : undefined,
  };
}
