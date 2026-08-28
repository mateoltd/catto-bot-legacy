import { describe, expect, it } from 'vitest';
import { UpdateVanityConfigDto } from '#lib/dtos/vanity/vanity-config.dto.js';
import { validateDto } from '#lib/validation/validate-dto.js';

const validConfig = {
  enabled: true,
  keyword: '/meetspace',
  roleId: '111111111111111111',
  thankYouEnabled: true,
  thankYouChannelId: '222222222222222222',
  thankYouMessage: 'Thanks {user}, you received {role}.',
};

describe('UpdateVanityConfigDto', () => {
  it('accepts a complete configuration and nullable draft destinations', async () => {
    await expect(validateDto(UpdateVanityConfigDto, validConfig)).resolves.toMatchObject({
      success: true,
    });
    await expect(
      validateDto(UpdateVanityConfigDto, {
        ...validConfig,
        enabled: false,
        roleId: null,
        thankYouEnabled: false,
        thankYouChannelId: null,
      }),
    ).resolves.toMatchObject({ success: true });
  });

  it('rejects partial replacements, invalid snowflakes, and oversized templates', async () => {
    const partial = await validateDto(UpdateVanityConfigDto, { enabled: true });
    expect(partial.success).toBe(false);
    expect(partial.errors?.map((error) => error.field)).toContain('keyword');

    const invalidIds = await validateDto(UpdateVanityConfigDto, {
      ...validConfig,
      roleId: 'not-a-role',
    });
    expect(invalidIds.success).toBe(false);
    expect(invalidIds.errors?.map((error) => error.field)).toContain('roleId');

    const oversized = await validateDto(UpdateVanityConfigDto, {
      ...validConfig,
      thankYouMessage: 'x'.repeat(1501),
    });
    expect(oversized.success).toBe(false);
    expect(oversized.errors?.map((error) => error.field)).toContain('thankYouMessage');
  });
});
