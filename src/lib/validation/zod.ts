import { z } from 'zod';

/**
 * Zod schema for Discord Snowflake IDs
 * Snowflakes are 17-19 digit strings
 */
export const snowflakeSchema = z.string().regex(/^\d{17,19}$/, 'Invalid Snowflake ID');

/**
 * Zod schema for duration strings (e.g., "10m", "1h", "2d")
 */
export const durationStringSchema = z
  .string()
  .regex(/^(\d+[smhdw])+$/, 'Invalid duration format. Use formats like: 10m, 1h, 2d, 1w');

/**
 * Zod schema for a reason string
 */
export const reasonSchema = z.string().max(512).optional();

/**
 * Zod schema for required reason
 */
export const reasonRequiredSchema = z.string().min(1).max(512);

/**
 * Safely parse with Zod, returning a discriminated result
 */
export function safeParse<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.output<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues;
  return { success: false, error: issues[0]?.message ?? 'Validation failed' };
}

/**
 * Parse with Zod, throwing a user-friendly error on failure
 */
export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues;
  const message = issues[0]?.message ?? 'Validation failed';
  throw new ValidationError(message);
}

/**
 * Custom validation error for user-facing messages
 */
export class ValidationError extends Error {
  public readonly isValidationError = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
