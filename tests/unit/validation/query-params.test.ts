import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  snowflakeSchema,
  durationStringSchema,
  reasonSchema,
  safeParse,
  parseOrThrow,
  ValidationError,
  isValidationError,
} from '../../../src/lib/validation/zod.js';
import { parseModAction } from '../../../src/lib/validation/modAction.js';

// ---------------------------------------------------------------------------
// snowflakeSchema
// ---------------------------------------------------------------------------
describe('snowflakeSchema', () => {
  it('accepts a valid 17-digit snowflake', () => {
    const result = snowflakeSchema.safeParse('12345678901234567');
    expect(result.success).toBe(true);
  });

  it('accepts a valid 18-digit snowflake', () => {
    const result = snowflakeSchema.safeParse('123456789012345678');
    expect(result.success).toBe(true);
  });

  it('accepts a valid 19-digit snowflake', () => {
    const result = snowflakeSchema.safeParse('1234567890123456789');
    expect(result.success).toBe(true);
  });

  it('rejects a snowflake that is too short (16 digits)', () => {
    const result = snowflakeSchema.safeParse('1234567890123456');
    expect(result.success).toBe(false);
  });

  it('rejects a snowflake that is too long (20 digits)', () => {
    const result = snowflakeSchema.safeParse('12345678901234567890');
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    const result = snowflakeSchema.safeParse('abcdefghijklmnopq');
    expect(result.success).toBe(false);
  });

  it('rejects a string with mixed alphanumeric characters', () => {
    const result = snowflakeSchema.safeParse('1234567890abcdefg');
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = snowflakeSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects a string with spaces', () => {
    const result = snowflakeSchema.safeParse('12345678901234567 ');
    expect(result.success).toBe(false);
  });

  it('rejects a string with leading/trailing whitespace', () => {
    const result = snowflakeSchema.safeParse(' 12345678901234567');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// durationStringSchema
// ---------------------------------------------------------------------------
describe('durationStringSchema', () => {
  it.each([
    ['10m', 'minutes'],
    ['1h', 'hours'],
    ['2d', 'days'],
    ['1w', 'weeks'],
    ['30s', 'seconds'],
    ['5h', 'hours'],
  ])('accepts valid duration "%s" (%s)', (input) => {
    const result = durationStringSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts compound durations like "1h30m"', () => {
    const result = durationStringSchema.safeParse('1h30m');
    expect(result.success).toBe(true);
  });

  it('accepts compound durations like "1d12h30m"', () => {
    const result = durationStringSchema.safeParse('1d12h30m');
    expect(result.success).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = durationStringSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects a plain number without unit', () => {
    const result = durationStringSchema.safeParse('10');
    expect(result.success).toBe(false);
  });

  it('rejects a unit without number', () => {
    const result = durationStringSchema.safeParse('m');
    expect(result.success).toBe(false);
  });

  it('rejects an invalid unit suffix', () => {
    const result = durationStringSchema.safeParse('10x');
    expect(result.success).toBe(false);
  });

  it('rejects negative durations', () => {
    const result = durationStringSchema.safeParse('-10m');
    expect(result.success).toBe(false);
  });

  it('rejects durations with spaces', () => {
    const result = durationStringSchema.safeParse('10 m');
    expect(result.success).toBe(false);
  });

  it('rejects floating point durations', () => {
    const result = durationStringSchema.safeParse('1.5h');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reasonSchema
// ---------------------------------------------------------------------------
describe('reasonSchema', () => {
  it('accepts undefined (optional)', () => {
    const result = reasonSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts an empty string', () => {
    const result = reasonSchema.safeParse('');
    expect(result.success).toBe(true);
  });

  it('accepts a short reason', () => {
    const result = reasonSchema.safeParse('Rule violation');
    expect(result.success).toBe(true);
  });

  it('accepts a reason at exactly 512 characters', () => {
    const result = reasonSchema.safeParse('a'.repeat(512));
    expect(result.success).toBe(true);
  });

  it('rejects a reason exceeding 512 characters', () => {
    const result = reasonSchema.safeParse('a'.repeat(513));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// safeParse
// ---------------------------------------------------------------------------
describe('safeParse', () => {
  it('returns success with parsed data on valid input', () => {
    const schema = z.string().min(1);
    const result = safeParse(schema, 'hello');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('returns error with message on invalid input', () => {
    const schema = z.string().min(5);
    const result = safeParse(schema, 'hi');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns the first issue message on multiple validation errors', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });
    const result = safeParse(schema, { name: '', age: -1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
    }
  });

  it('applies Zod transforms correctly', () => {
    const schema = z.string().transform((s) => s.toUpperCase());
    const result = safeParse(schema, 'hello');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('HELLO');
    }
  });

  it('handles snowflakeSchema through safeParse', () => {
    const valid = safeParse(snowflakeSchema, '123456789012345678');
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data).toBe('123456789012345678');
    }

    const invalid = safeParse(snowflakeSchema, 'not-a-snowflake');
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error).toBe('Invalid Snowflake ID');
    }
  });
});

// ---------------------------------------------------------------------------
// parseOrThrow
// ---------------------------------------------------------------------------
describe('parseOrThrow', () => {
  it('returns the parsed value on valid input', () => {
    const schema = z.string().min(1);
    const result = parseOrThrow(schema, 'hello');
    expect(result).toBe('hello');
  });

  it('returns transformed value on valid input', () => {
    const schema = z.string().transform((s) => parseInt(s, 10));
    const result = parseOrThrow(schema, '42');
    expect(result).toBe(42);
  });

  it('throws a ValidationError on invalid input', () => {
    const schema = z.string().min(5);
    expect(() => parseOrThrow(schema, 'hi')).toThrow(ValidationError);
  });

  it('thrown error has the correct message from the schema', () => {
    const schema = z.string().regex(/^\d+$/, 'Must be numeric');
    expect(() => parseOrThrow(schema, 'abc')).toThrow('Must be numeric');
  });

  it('thrown error is an instance of Error', () => {
    const schema = z.number();
    try {
      parseOrThrow(schema, 'not-a-number');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ValidationError);
    }
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------
describe('ValidationError', () => {
  it('has the name "ValidationError"', () => {
    const err = new ValidationError('test message');
    expect(err.name).toBe('ValidationError');
  });

  it('has the correct message', () => {
    const err = new ValidationError('something went wrong');
    expect(err.message).toBe('something went wrong');
  });

  it('is an instance of Error', () => {
    const err = new ValidationError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('has isValidationError set to true', () => {
    const err = new ValidationError('test');
    expect(err.isValidationError).toBe(true);
  });

  it('is detected by isValidationError type guard', () => {
    const err = new ValidationError('test');
    expect(isValidationError(err)).toBe(true);
  });

  it('isValidationError returns false for plain Error', () => {
    const err = new Error('test');
    expect(isValidationError(err)).toBe(false);
  });

  it('isValidationError returns false for non-error values', () => {
    expect(isValidationError('string')).toBe(false);
    expect(isValidationError(null)).toBe(false);
    expect(isValidationError(undefined)).toBe(false);
    expect(isValidationError(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseModAction
// ---------------------------------------------------------------------------
describe('parseModAction', () => {
  const validActions = [
    'BAN',
    'UNBAN',
    'KICK',
    'TIMEOUT',
    'WARN',
    'SOFTBAN',
    'TEMPBAN',
    'MUTE_TEXT',
    'MUTE_VOICE',
    'MUTE_BOTH',
    'UNMUTE_TEXT',
    'UNMUTE_VOICE',
    'UNMUTE_BOTH',
  ] as const;

  it.each(validActions)('accepts valid ModAction "%s"', (action) => {
    const result = parseModAction(action);
    expect(result).toBe(action);
  });

  it('rejects an invalid action string', () => {
    expect(parseModAction('INVALID')).toBeUndefined();
  });

  it('rejects an empty string', () => {
    expect(parseModAction('')).toBeUndefined();
  });

  it('is case-sensitive (lowercase "ban" is rejected)', () => {
    expect(parseModAction('ban')).toBeUndefined();
  });

  it('is case-sensitive (mixed case "Ban" is rejected)', () => {
    expect(parseModAction('Ban')).toBeUndefined();
  });

  it('is case-sensitive (lowercase "kick" is rejected)', () => {
    expect(parseModAction('kick')).toBeUndefined();
  });

  it('rejects action with extra whitespace', () => {
    expect(parseModAction(' BAN')).toBeUndefined();
    expect(parseModAction('BAN ')).toBeUndefined();
  });

  it('rejects a numeric string', () => {
    expect(parseModAction('123')).toBeUndefined();
  });
});
