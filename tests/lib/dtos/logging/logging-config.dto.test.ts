import { describe, it, expect } from 'vitest';
import { validateDto } from '#lib/validation/validate-dto.js';
import {
  LogSetupDto,
  UpdateLogConfigDto,
  IgnoredChannelsDto,
} from '#lib/dtos/logging/logging-config.dto.js';

describe('LogSetupDto', () => {
  it('accepts valid log types', async () => {
    const result = await validateDto(LogSetupDto, {
      enabledTypes: ['MESSAGE_DELETE', 'MESSAGE_EDIT', 'MEMBER_JOIN'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.enabledTypes).toHaveLength(3);
  });

  it('requires enabledTypes array', async () => {
    const result = await validateDto(LogSetupDto, {});
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === 'enabledTypes')).toBe(true);
  });

  it('rejects empty array', async () => {
    const result = await validateDto(LogSetupDto, {
      enabledTypes: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts any string as log type', async () => {
    const result = await validateDto(LogSetupDto, {
      enabledTypes: ['CUSTOM_TYPE'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid log types', async () => {
    const validTypes = [
      'MESSAGE_DELETE',
      'MESSAGE_EDIT',
      'MEMBER_JOIN',
      'MEMBER_LEAVE',
      'MEMBER_BAN',
      'MEMBER_UNBAN',
      'MEMBER_KICK',
      'MEMBER_UPDATE',
      'CHANNEL_CREATE',
      'CHANNEL_DELETE',
      'CHANNEL_UPDATE',
      'ROLE_CREATE',
      'ROLE_DELETE',
      'ROLE_UPDATE',
      'VOICE_JOIN',
      'VOICE_LEAVE',
      'VOICE_MOVE',
    ];

    const result = await validateDto(LogSetupDto, {
      enabledTypes: validTypes,
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateLogConfigDto', () => {
  describe('enabled field', () => {
    it('accepts boolean values', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabled: true,
      });
      expect(result.success).toBe(true);
    });

    it('is optional', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabledTypes: ['MESSAGE_DELETE'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('channelId field', () => {
    it('accepts valid Discord ID', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        channelId: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('accepts null', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        channelId: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid Discord ID', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        channelId: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('is optional', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabledTypes: ['MESSAGE_DELETE'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('enabledTypes field', () => {
    it('accepts valid log types', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabledTypes: ['MESSAGE_DELETE', 'MEMBER_JOIN'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty array', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabledTypes: [],
      });
      expect(result.success).toBe(true);
    });

    it('accepts any string types', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabledTypes: ['CUSTOM_TYPE'],
      });
      expect(result.success).toBe(true);
    });

    it('is optional', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabled: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ignoredChannels field', () => {
    it('accepts array of Discord IDs', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        ignoredChannels: ['123456789012345678', '987654321098765432'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty array', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        ignoredChannels: [],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid Discord IDs', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        ignoredChannels: ['invalid', '123'],
      });
      expect(result.success).toBe(false);
    });

    it('is optional', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabled: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('complex updates', () => {
    it('accepts complete update', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabled: true,
        channelId: '123456789012345678',
        enabledTypes: ['MESSAGE_DELETE', 'MESSAGE_EDIT'],
        ignoredChannels: ['999888777666555444'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial update', async () => {
      const result = await validateDto(UpdateLogConfigDto, {
        enabled: false,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', async () => {
      const result = await validateDto(UpdateLogConfigDto, {});
      expect(result.success).toBe(true);
    });
  });
});

describe('IgnoredChannelsDto', () => {
  it('accepts array of valid Discord IDs', async () => {
    const result = await validateDto(IgnoredChannelsDto, {
      channelIds: ['123456789012345678', '987654321098765432'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.channelIds).toHaveLength(2);
  });

  it('requires channelIds array', async () => {
    const result = await validateDto(IgnoredChannelsDto, {});
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === 'channelIds')).toBe(true);
  });

  it('accepts empty array', async () => {
    const result = await validateDto(IgnoredChannelsDto, {
      channelIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid Discord IDs', async () => {
    const result = await validateDto(IgnoredChannelsDto, {
      channelIds: ['invalid', '12345'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-array values', async () => {
    const result = await validateDto(IgnoredChannelsDto, {
      channelIds: '123456789012345678',
    });
    expect(result.success).toBe(false);
  });

  it('validates each element', async () => {
    const result = await validateDto(IgnoredChannelsDto, {
      channelIds: [
        '123456789012345678', // valid
        'invalid', // invalid
        '987654321098765432', // valid
      ],
    });
    expect(result.success).toBe(false);
  });
});
