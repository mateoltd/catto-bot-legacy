import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockUpsert, mockUpdateMany, mockFindMany, mockFindUnique } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock('@sapphire/framework', async () => {
  const actual = await vi.importActual('@sapphire/framework');
  return {
    ...actual,
    container: {
      prisma: {
        userFlag: {
          upsert: mockUpsert,
          updateMany: mockUpdateMany,
          findMany: mockFindMany,
          findUnique: mockFindUnique,
        },
      },
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
    },
  };
});

import { userFlagService } from '#modules/moderation/services/UserFlagService.js';

const GUILD_ID = 'guild-1' as any;
const USER_ID = 'user-1' as any;
const MOD_ID = 'mod-1' as any;

function createMockFlag(overrides: Partial<{
  id: string;
  guildId: string;
  userId: string;
  flag: string;
  reason: string | null;
  createdById: string;
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
}> = {}) {
  return {
    id: overrides.id ?? 'flag-1',
    guildId: overrides.guildId ?? GUILD_ID,
    userId: overrides.userId ?? USER_ID,
    flag: overrides.flag ?? 'SUSPICIOUS',
    reason: overrides.reason ?? 'Test reason',
    createdById: overrides.createdById ?? MOD_ID,
    createdAt: overrides.createdAt ?? new Date(),
    expiresAt: overrides.expiresAt ?? null,
    active: overrides.active ?? true,
  };
}

describe('UserFlagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('addFlag', () => {
    it('creates a flag via upsert', async () => {
      const mockFlag = createMockFlag();
      mockUpsert.mockResolvedValue(mockFlag);

      const result = await userFlagService.addFlag({
        guildId: GUILD_ID,
        userId: USER_ID,
        flag: 'SUSPICIOUS',
        reason: 'Suspicious activity',
        createdById: MOD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.flag).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          guildId_userId_flag: {
            guildId: GUILD_ID,
            userId: USER_ID,
            flag: 'SUSPICIOUS',
          },
        },
        update: expect.objectContaining({
          reason: 'Suspicious activity',
          active: true,
        }),
        create: expect.objectContaining({
          guildId: GUILD_ID,
          userId: USER_ID,
          flag: 'SUSPICIOUS',
          reason: 'Suspicious activity',
          active: true,
        }),
      });
    });

    it('creates flag with expiry from duration', async () => {
      const mockFlag = createMockFlag({
        expiresAt: new Date('2025-01-15T13:00:00.000Z'),
      });
      mockUpsert.mockResolvedValue(mockFlag);

      const result = await userFlagService.addFlag({
        guildId: GUILD_ID,
        userId: USER_ID,
        flag: 'RAID_PARTICIPANT',
        createdById: MOD_ID,
        duration: 3600, // 1 hour in seconds
      });

      expect(result.success).toBe(true);
      // Verify expiry is 1 hour from now
      const upsertCall = mockUpsert.mock.calls[0]![0];
      const expiresAt = upsertCall.create.expiresAt as Date;
      expect(expiresAt.getTime()).toBe(new Date('2025-01-15T13:00:00.000Z').getTime());
    });

    it('sets null reason when not provided', async () => {
      mockUpsert.mockResolvedValue(createMockFlag({ reason: null }));

      await userFlagService.addFlag({
        guildId: GUILD_ID,
        userId: USER_ID,
        flag: 'TRUSTED',
        createdById: MOD_ID,
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ reason: null }),
        })
      );
    });

    it('returns error on database failure', async () => {
      mockUpsert.mockRejectedValue(new Error('DB error'));

      const result = await userFlagService.addFlag({
        guildId: GUILD_ID,
        userId: USER_ID,
        flag: 'SUSPICIOUS',
        createdById: MOD_ID,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to add flag');
    });
  });

  describe('removeFlag', () => {
    it('soft-deletes by setting active=false', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const result = await userFlagService.removeFlag(GUILD_ID, USER_ID, 'SUSPICIOUS');

      expect(result.success).toBe(true);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          guildId: GUILD_ID,
          userId: USER_ID,
          flag: 'SUSPICIOUS',
          active: true,
        },
        data: { active: false },
      });
    });

    it('returns error on database failure', async () => {
      mockUpdateMany.mockRejectedValue(new Error('DB error'));

      const result = await userFlagService.removeFlag(GUILD_ID, USER_ID, 'SUSPICIOUS');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to remove flag');
    });
  });

  describe('getActiveFlags', () => {
    it('cleans up expired flags before returning', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([createMockFlag({ flag: 'TRUSTED' })]);

      const flags = await userFlagService.getActiveFlags(GUILD_ID, USER_ID);

      // Cleanup should run first
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          guildId: GUILD_ID,
          userId: USER_ID,
          active: true,
          expiresAt: { lte: expect.any(Date) },
        },
        data: { active: false },
      });

      expect(flags).toHaveLength(1);
      expect(flags[0]!.flag).toBe('TRUSTED');
    });

    it('returns empty array when no active flags', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([]);

      const flags = await userFlagService.getActiveFlags(GUILD_ID, USER_ID);

      expect(flags).toEqual([]);
    });
  });

  describe('hasFlag', () => {
    it('returns true for active flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(createMockFlag({ active: true }));

      const result = await userFlagService.hasFlag(GUILD_ID, USER_ID, 'SUSPICIOUS');

      expect(result).toBe(true);
    });

    it('returns false for inactive flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(createMockFlag({ active: false }));

      const result = await userFlagService.hasFlag(GUILD_ID, USER_ID, 'SUSPICIOUS');

      expect(result).toBe(false);
    });

    it('returns false when flag does not exist', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(null);

      const result = await userFlagService.hasFlag(GUILD_ID, USER_ID, 'SUSPICIOUS');

      expect(result).toBe(false);
    });
  });

  describe('isTrusted', () => {
    it('returns true for user with TRUSTED flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(createMockFlag({ flag: 'TRUSTED', active: true }));

      const result = await userFlagService.isTrusted(GUILD_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns false for user without TRUSTED flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(null);

      const result = await userFlagService.isTrusted(GUILD_ID, USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('isSuspicious', () => {
    it('returns true when user has SUSPICIOUS flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([createMockFlag({ flag: 'SUSPICIOUS' })]);

      const result = await userFlagService.isSuspicious(GUILD_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns true when user has AUTO_FLAGGED flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([createMockFlag({ flag: 'AUTO_FLAGGED' })]);

      const result = await userFlagService.isSuspicious(GUILD_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns true when user has RAID_PARTICIPANT flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([createMockFlag({ flag: 'RAID_PARTICIPANT' })]);

      const result = await userFlagService.isSuspicious(GUILD_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns true when user has ALT_ACCOUNT flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([createMockFlag({ flag: 'ALT_ACCOUNT' })]);

      const result = await userFlagService.isSuspicious(GUILD_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns false when user only has TRUSTED flag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([createMockFlag({ flag: 'TRUSTED' })]);

      const result = await userFlagService.isSuspicious(GUILD_ID, USER_ID);

      expect(result).toBe(false);
    });

    it('returns false when user has no flags', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([]);

      const result = await userFlagService.isSuspicious(GUILD_ID, USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('getFlagSummary', () => {
    it('returns complete flag summary', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([
        createMockFlag({ flag: 'SUSPICIOUS' }),
        createMockFlag({ flag: 'TRUSTED' }),
      ]);

      const summary = await userFlagService.getFlagSummary(GUILD_ID, USER_ID);

      expect(summary.flags).toEqual(['SUSPICIOUS', 'TRUSTED']);
      expect(summary.isTrusted).toBe(true);
      expect(summary.isSuspicious).toBe(true);
    });

    it('returns empty summary for user with no flags', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindMany.mockResolvedValue([]);

      const summary = await userFlagService.getFlagSummary(GUILD_ID, USER_ID);

      expect(summary.flags).toEqual([]);
      expect(summary.isTrusted).toBe(false);
      expect(summary.isSuspicious).toBe(false);
    });
  });

  describe('listFlaggedUsers', () => {
    it('lists users with specific flag type', async () => {
      mockFindMany.mockResolvedValue([
        createMockFlag({ userId: 'user-1' as any }),
        createMockFlag({ userId: 'user-2' as any }),
      ]);

      const users = await userFlagService.listFlaggedUsers(GUILD_ID, 'SUSPICIOUS');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { guildId: GUILD_ID, active: true, flag: 'SUSPICIOUS' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(users).toHaveLength(2);
    });

    it('lists all flagged users when no flag type specified', async () => {
      mockFindMany.mockResolvedValue([]);

      await userFlagService.listFlaggedUsers(GUILD_ID);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { guildId: GUILD_ID, active: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('flags are guild-scoped', async () => {
      mockFindMany.mockResolvedValue([]);

      await userFlagService.listFlaggedUsers('guild-A' as any);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: 'guild-A' }),
        })
      );
    });

    it('respects custom limit', async () => {
      mockFindMany.mockResolvedValue([]);

      await userFlagService.listFlaggedUsers(GUILD_ID, undefined, 10);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('expired flag cleanup', () => {
    it('deactivates expired flags on getActiveFlags', async () => {
      mockUpdateMany.mockResolvedValue({ count: 2 });
      mockFindMany.mockResolvedValue([]);

      await userFlagService.getActiveFlags(GUILD_ID, USER_ID);

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          guildId: GUILD_ID,
          userId: USER_ID,
          active: true,
          expiresAt: { lte: new Date('2025-01-15T12:00:00.000Z') },
        },
        data: { active: false },
      });
    });

    it('deactivates expired flags on hasFlag', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(null);

      await userFlagService.hasFlag(GUILD_ID, USER_ID, 'SUSPICIOUS');

      // Cleanup should have been called
      expect(mockUpdateMany).toHaveBeenCalled();
    });
  });
});
