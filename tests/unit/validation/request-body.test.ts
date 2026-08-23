import { describe, it, expect } from 'vitest';
import { IsString, IsNumber, IsOptional, IsUrl } from 'class-validator';
import { Expose } from 'class-transformer';
import { validateDto } from '#lib/validation/validate-dto.js';
import {
  IsDiscordId,
  IsDiscordIdArray,
  IsDiscordWebhook,
} from '#lib/validation/decorators/discord.decorators.js';
import { UpdateModConfigDto } from '#lib/dtos/moderation/moderation-config.dto.js';

// ---------------------------------------------------------------------------
// Test DTOs (small classes used solely for testing validateDto directly)
// ---------------------------------------------------------------------------

class SimpleDto {
  @IsString()
  name!: string;

  @IsNumber()
  age!: number;
}

class OptionalFieldDto {
  @IsString()
  required!: string;

  @IsString()
  @IsOptional()
  optional?: string;
}

class WhitelistDto {
  @Expose()
  @IsString()
  allowed!: string;
}

class DiscordIdTestDto {
  @IsDiscordId()
  channelId!: string;
}

class DiscordIdArrayTestDto {
  @IsDiscordIdArray()
  roleIds!: string[];
}

class DiscordWebhookTestDto {
  @IsDiscordWebhook()
  webhookUrl!: string;
}

class UrlTestDto {
  @IsUrl()
  link!: string;
}

// ---------------------------------------------------------------------------
// validateDto() core behaviour
// ---------------------------------------------------------------------------

describe('validateDto()', () => {
  describe('success path', () => {
    it('returns success=true for valid data', async () => {
      const result = await validateDto(SimpleDto, { name: 'Alice', age: 30 });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Alice');
      expect(result.data!.age).toBe(30);
    });

    it('returns success=true when optional fields are omitted', async () => {
      const result = await validateDto(OptionalFieldDto, { required: 'hello' });
      expect(result.success).toBe(true);
      expect(result.data!.required).toBe('hello');
      expect(result.data!.optional).toBeUndefined();
    });
  });

  describe('failure path', () => {
    it('returns success=false with structured errors for invalid data', async () => {
      const result = await validateDto(SimpleDto, { name: 123, age: 'not a number' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors!.length).toBeGreaterThan(0);

      // Each error has field + constraints shape
      for (const error of result.errors!) {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('constraints');
        expect(Array.isArray(error.constraints)).toBe(true);
        expect(error.constraints.length).toBeGreaterThan(0);
      }
    });

    it('returns field-level error messages', async () => {
      const result = await validateDto(SimpleDto, { name: 123, age: 'bad' });
      expect(result.success).toBe(false);

      const nameError = result.errors!.find((e) => e.field === 'name');
      const ageError = result.errors!.find((e) => e.field === 'age');
      expect(nameError).toBeDefined();
      expect(ageError).toBeDefined();
      expect(nameError!.constraints.length).toBeGreaterThan(0);
      expect(ageError!.constraints.length).toBeGreaterThan(0);
    });

    it('returns errors when required fields are missing', async () => {
      const result = await validateDto(SimpleDto, {});
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.field === 'name')).toBe(true);
      expect(result.errors!.some((e) => e.field === 'age')).toBe(true);
    });
  });

  describe('whitelist: true strips unknown properties', () => {
    it('does not include unknown properties in the output data', async () => {
      const result = await validateDto(WhitelistDto, {
        allowed: 'keep-me',
        unknown: 'strip-me',
        extra: 42,
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.allowed).toBe('keep-me');

      // The whitelist option in validateDto strips keys not declared in the DTO
      const dataKeys = Object.keys(result.data as object);
      expect(dataKeys).not.toContain('unknown');
      expect(dataKeys).not.toContain('extra');
    });
  });
});

// ---------------------------------------------------------------------------
// @IsDiscordId() decorator
// ---------------------------------------------------------------------------

describe('@IsDiscordId()', () => {
  const valid17 = '12345678901234567';
  const valid18 = '123456789012345678';
  const valid19 = '1234567890123456789';

  it('accepts a 17-digit snowflake', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: valid17 });
    expect(result.success).toBe(true);
  });

  it('accepts an 18-digit snowflake', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: valid18 });
    expect(result.success).toBe(true);
  });

  it('accepts a 19-digit snowflake', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: valid19 });
    expect(result.success).toBe(true);
  });

  it('rejects a snowflake that is too short (16 digits)', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: '1234567890123456' });
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.field === 'channelId')).toBe(true);
  });

  it('rejects a snowflake that is too long (20 digits)', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: '12345678901234567890' });
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.field === 'channelId')).toBe(true);
  });

  it('rejects non-numeric strings', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: 'abcdefghijklmnopqr' });
    expect(result.success).toBe(false);
  });

  it('rejects a string with letters mixed in', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: '12345678901234567a' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a number type (must be string)', async () => {
    const result = await validateDto(DiscordIdTestDto, { channelId: 123456789012345678 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// @IsDiscordIdArray() decorator
// ---------------------------------------------------------------------------

describe('@IsDiscordIdArray()', () => {
  it('accepts an array of valid snowflakes', async () => {
    const result = await validateDto(DiscordIdArrayTestDto, {
      roleIds: ['123456789012345678', '987654321098765432', '12345678901234567'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty array', async () => {
    const result = await validateDto(DiscordIdArrayTestDto, { roleIds: [] });
    expect(result.success).toBe(true);
  });

  it('rejects an array containing an invalid entry', async () => {
    const result = await validateDto(DiscordIdArrayTestDto, {
      roleIds: ['123456789012345678', 'invalid', '987654321098765432'],
    });
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.field === 'roleIds')).toBe(true);
  });

  it('rejects an array with a too-short ID', async () => {
    const result = await validateDto(DiscordIdArrayTestDto, {
      roleIds: ['1234567890123456'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-array value', async () => {
    const result = await validateDto(DiscordIdArrayTestDto, {
      roleIds: '123456789012345678',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an array containing a numeric type instead of string', async () => {
    const result = await validateDto(DiscordIdArrayTestDto, {
      roleIds: [123456789012345678],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// @IsDiscordWebhook() decorator
// ---------------------------------------------------------------------------

describe('@IsDiscordWebhook()', () => {
  const validWebhook =
    'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz';

  it('accepts a valid Discord webhook URL', async () => {
    const result = await validateDto(DiscordWebhookTestDto, { webhookUrl: validWebhook });
    expect(result.success).toBe(true);
  });

  it('accepts a webhook URL with a complex token', async () => {
    const result = await validateDto(DiscordWebhookTestDto, {
      webhookUrl: 'https://discord.com/api/webhooks/1234567890123456789/AbC-dEf_123.xyz',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a URL with http:// instead of https://', async () => {
    const result = await validateDto(DiscordWebhookTestDto, {
      webhookUrl: 'http://discord.com/api/webhooks/123456789012345678/token',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a URL on a different domain', async () => {
    const result = await validateDto(DiscordWebhookTestDto, {
      webhookUrl: 'https://example.com/api/webhooks/123456789012345678/token',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a URL missing the token segment', async () => {
    const result = await validateDto(DiscordWebhookTestDto, {
      webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/',
    });
    // The regex requires ".+" after the last slash, and an empty string after / does not match
    expect(result.success).toBe(false);
  });

  it('rejects a URL with an invalid webhook ID (too short)', async () => {
    const result = await validateDto(DiscordWebhookTestDto, {
      webhookUrl: 'https://discord.com/api/webhooks/1234/token',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', async () => {
    const result = await validateDto(DiscordWebhookTestDto, { webhookUrl: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-string value', async () => {
    const result = await validateDto(DiscordWebhookTestDto, { webhookUrl: 12345 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateModConfigDto validation
// ---------------------------------------------------------------------------

describe('UpdateModConfigDto', () => {
  it('accepts a fully valid config', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      modLogChannelId: '123456789012345678',
      muteRoleId: '987654321098765432',
      autoModEnabled: true,
      watermarkDownloads: false,
      watermarkText: 'Confidential',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.modLogChannelId).toBe('123456789012345678');
  });

  it('accepts an empty object (all fields optional)', async () => {
    const result = await validateDto(UpdateModConfigDto, {});
    expect(result.success).toBe(true);
  });

  it('accepts null for nullable channel ID fields', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      modLogChannelId: null,
      muteRoleId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid channel ID', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      modLogChannelId: 'not-a-snowflake',
    });
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.field === 'modLogChannelId')).toBe(true);
  });

  it('rejects an invalid mute role ID', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      muteRoleId: '12345',
    });
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.field === 'muteRoleId')).toBe(true);
  });

  it('accepts boolean values for autoModEnabled', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      autoModEnabled: true,
    });
    expect(result.success).toBe(true);
    expect(result.data!.autoModEnabled).toBe(true);
  });

  it('accepts boolean values for watermarkDownloads', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      watermarkDownloads: false,
    });
    expect(result.success).toBe(true);
    expect(result.data!.watermarkDownloads).toBe(false);
  });

  it('accepts null for watermarkText', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      watermarkText: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a string for watermarkText', async () => {
    const result = await validateDto(UpdateModConfigDto, {
      watermarkText: 'Server Watermark',
    });
    expect(result.success).toBe(true);
    expect(result.data!.watermarkText).toBe('Server Watermark');
  });
});

// ---------------------------------------------------------------------------
// URL format validation (javascript: protocol rejection)
// ---------------------------------------------------------------------------

describe('URL format validation', () => {
  it('rejects javascript: protocol URLs', async () => {
    const result = await validateDto(UrlTestDto, {
      link: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });

  it('rejects data: protocol URLs', async () => {
    const result = await validateDto(UrlTestDto, {
      link: 'data:text/html,<script>alert(1)</script>',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid https URL', async () => {
    const result = await validateDto(UrlTestDto, {
      link: 'https://example.com/page',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid http URL', async () => {
    const result = await validateDto(UrlTestDto, {
      link: 'http://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty string', async () => {
    const result = await validateDto(UrlTestDto, {
      link: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a plain string that is not a URL', async () => {
    const result = await validateDto(UrlTestDto, {
      link: 'not a url at all',
    });
    expect(result.success).toBe(false);
  });
});
