import { describe, it, expect } from 'vitest';
import { validateDto } from '#lib/validation/validate-dto.js';
import { UpdateXPConfigDto, XPMode, LevelCurveType } from '#lib/dtos/xp/update-xp-config.dto.js';

describe('UpdateXPConfigDto', () => {
  describe('enabled', () => {
    it('accepts boolean values', async () => {
      const result = await validateDto(UpdateXPConfigDto, { enabled: true });
      expect(result.success).toBe(true);
      expect(result.data?.enabled).toBe(true);
    });

    it('is optional', async () => {
      const result = await validateDto(UpdateXPConfigDto, {});
      expect(result.success).toBe(true);
    });
  });

  describe('cooldownSec', () => {
    it('accepts valid cooldown values', async () => {
      const result = await validateDto(UpdateXPConfigDto, { cooldownSec: 60 });
      expect(result.success).toBe(true);
      expect(result.data?.cooldownSec).toBe(60);
    });

    it('rejects negative values', async () => {
      const result = await validateDto(UpdateXPConfigDto, { cooldownSec: -1 });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'cooldownSec')).toBe(true);
    });

    it('rejects values over 3600', async () => {
      const result = await validateDto(UpdateXPConfigDto, { cooldownSec: 3601 });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'cooldownSec')).toBe(true);
    });
  });

  describe('xpMode', () => {
    it('accepts RANDOM mode', async () => {
      const result = await validateDto(UpdateXPConfigDto, { xpMode: XPMode.RANDOM });
      expect(result.success).toBe(true);
      expect(result.data?.xpMode).toBe(XPMode.RANDOM);
    });

    it('accepts FIXED mode', async () => {
      const result = await validateDto(UpdateXPConfigDto, { xpMode: XPMode.FIXED });
      expect(result.success).toBe(true);
      expect(result.data?.xpMode).toBe(XPMode.FIXED);
    });

    it('rejects invalid mode', async () => {
      const result = await validateDto(UpdateXPConfigDto, { xpMode: 'INVALID' });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'xpMode')).toBe(true);
    });
  });

  describe('XP values', () => {
    it('accepts valid minXp', async () => {
      const result = await validateDto(UpdateXPConfigDto, { minXp: 10 });
      expect(result.success).toBe(true);
      expect(result.data?.minXp).toBe(10);
    });

    it('accepts valid maxXp', async () => {
      const result = await validateDto(UpdateXPConfigDto, { maxXp: 20 });
      expect(result.success).toBe(true);
      expect(result.data?.maxXp).toBe(20);
    });

    it('accepts valid fixedXp', async () => {
      const result = await validateDto(UpdateXPConfigDto, { fixedXp: 15 });
      expect(result.success).toBe(true);
      expect(result.data?.fixedXp).toBe(15);
    });

    it('rejects negative minXp', async () => {
      const result = await validateDto(UpdateXPConfigDto, { minXp: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('minMessageLength', () => {
    it('accepts valid length', async () => {
      const result = await validateDto(UpdateXPConfigDto, { minMessageLength: 5 });
      expect(result.success).toBe(true);
      expect(result.data?.minMessageLength).toBe(5);
    });

    it('rejects values over 2000', async () => {
      const result = await validateDto(UpdateXPConfigDto, { minMessageLength: 2001 });
      expect(result.success).toBe(false);
    });
  });

  describe('Discord ID arrays', () => {
    it('accepts valid channel IDs', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        allowedChannels: ['123456789012345678', '987654321098765432'],
      });
      expect(result.success).toBe(true);
      expect(result.data?.allowedChannels).toHaveLength(2);
    });

    it('rejects invalid Discord IDs', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        allowedChannels: ['invalid', '123'],
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty arrays', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        allowedChannels: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('announcements', () => {
    it('accepts valid announcement config', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        announceLevelUp: true,
        announceChannelId: '123456789012345678',
        messageTemplate: 'Congrats {user}!',
        embedEnabled: true,
        embedColor: 0x00ff00,
      });
      expect(result.success).toBe(true);
    });

    it('accepts null announceChannelId', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        announceChannelId: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid embedColor', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        embedColor: 16777216, // 0xFFFFFF + 1
      });
      expect(result.success).toBe(false);
    });

    it('rejects too long messageTemplate', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        messageTemplate: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('level curve', () => {
    it('accepts valid level curve type', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        levelCurveType: LevelCurveType.FORMULA,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all curve types', async () => {
      for (const type of Object.values(LevelCurveType)) {
        const result = await validateDto(UpdateXPConfigDto, {
          levelCurveType: type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('accepts formula parameters', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        formulaBase: 100,
        formulaExponent: 1.5,
        formulaOffset: 50,
      });
      expect(result.success).toBe(true);
    });

    it('accepts table thresholds', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        tableThresholds: [100, 200, 300, 500, 800],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty table thresholds', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        tableThresholds: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('complex validation', () => {
    it('accepts complete valid configuration', async () => {
      const validConfig = {
        enabled: true,
        cooldownSec: 60,
        xpMode: XPMode.RANDOM,
        minXp: 10,
        maxXp: 20,
        minMessageLength: 5,
        allowedChannels: ['123456789012345678'],
        ignoredChannels: [],
        ignoredRoles: [],
        announceLevelUp: true,
        announceChannelId: '123456789012345678',
        messageTemplate: 'Level up!',
        embedEnabled: true,
        embedColor: 0x5865f2,
        levelCurveType: LevelCurveType.FORMULA,
        formulaBase: 100,
        formulaExponent: 1.2,
        formulaOffset: 0,
      };

      const result = await validateDto(UpdateXPConfigDto, validConfig);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(validConfig);
    });

    it('rejects multiple invalid fields', async () => {
      const result = await validateDto(UpdateXPConfigDto, {
        cooldownSec: -1,
        minXp: -5,
        xpMode: 'INVALID',
        embedColor: 999999999,
      });
      expect(result.success).toBe(false);
      const errorFields = (result.errors || []).map((e) => e.field);
      expect(errorFields).toContain('cooldownSec');
      expect(errorFields).toContain('minXp');
      expect(errorFields).toContain('xpMode');
    });
  });
});
