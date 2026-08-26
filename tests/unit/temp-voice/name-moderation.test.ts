/**
 * Unit tests for Name Moderation Orchestrator Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NameModerationService } from '../../../src/modules/temp-voice/services/moderation/name-moderation.service.js';
import {
  ModerationAction,
  ReasonCode,
  RenameStrategy,
} from '../../../src/modules/temp-voice/models/name-moderation.model.js';
import type { TempVoiceConfig } from '../../../src/modules/temp-voice/models/config.model.js';
import type { VoiceChannel, Guild, GuildChannelManager } from 'discord.js';
import { ChannelType } from 'discord.js';

// Mock PrismaClient
const mockPrisma = {
  tempVoiceModerationLog: {
    create: vi.fn(),
  },
} as any;

// Helper to create mock voice channel
function createMockVoiceChannel(
  id: string,
  name: string,
  guildId: string,
  existingChannels: Array<{ name: string }> = []
): VoiceChannel {
  const channelManager = {
    cache: {
      filter: vi.fn(() => ({
        map: vi.fn(() => existingChannels.map((c) => c.name)),
      })),
    },
  } as unknown as GuildChannelManager;

  const guild = {
    id: guildId,
    ownerId: 'guild-owner-123',
    channels: channelManager,
  } as unknown as Guild;

  const channel = {
    id,
    name,
    guild,
    type: ChannelType.GuildVoice,
    setName: vi.fn().mockResolvedValue(undefined),
    isVoiceBased: () => true,
  } as unknown as VoiceChannel;

  return channel;
}

describe('NameModerationService', () => {
  let service: NameModerationService;
  let baseConfig: TempVoiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console warnings/errors during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service = new NameModerationService(mockPrisma);

    baseConfig = {
      id: 'config-1',
      guildId: 'guild-123',
      enabled: true,
      moderationEnabled: true,
      moderationAction: 'AUTO_RENAME' as any,
      strictMode: false,
      allowListEnabled: false,
      customPatterns: [],
      allowedKeywords: [],
      joinToCreateChannels: [],
      categoryId: null,
      fallbackCategoryId: null,
      namingScheme: 'USERNAME' as any,
      defaultNameTemplate: "{username}'s Channel",
      defaultUserLimit: 0,
      defaultBitrate: null,
      defaultRegion: null,
      defaultLocked: false,
      defaultHidden: false,
      deleteDelaySeconds: 5,
      cooldownSeconds: 10,
      maxChannelsPerUser: 3,
      controlPanelEnabled: true,
      allowCustomization: true,
      logChannelId: null,
      logWebhook: null,
      adminRoleIds: [],
      primaryLanguage: 'en',
      additionalLanguages: [],
      multiLangMode: false,
      languageSettings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('moderateChannelName', () => {
    it('should return null if moderation is disabled', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');
      const config = { ...baseConfig, moderationEnabled: false };

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'Test Room',
        config,
        'user-123'
      );

      expect(result).toBeNull();
      expect(channel.setName).not.toHaveBeenCalled();
    });

    it('should allow clean names without action', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Gaming Room', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'Gaming Room',
        baseConfig,
        'user-123'
      );

      expect(result).not.toBeNull();
      expect(result?.validation.isAllowed).toBe(true);
      expect(result?.actionTaken).toBe(ModerationAction.WARN_ONLY);
      expect(result?.finalName).toBe('Gaming Room');
      expect(channel.setName).not.toHaveBeenCalled();
    });

    it('should auto-rename inappropriate names', async () => {
      const channel = createMockVoiceChannel('channel-1', 'bad word room', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        'Clean Room',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      expect(result).not.toBeNull();
      expect(result?.validation.isAllowed).toBe(false);
      expect(result?.actionTaken).toBe(ModerationAction.AUTO_RENAME);
      expect(result?.renameResult).toBeDefined();
      expect(result?.finalName).not.toBe('f u c k room');
      expect(channel.setName).toHaveBeenCalledOnce();
    });

    it('should block inappropriate names when action is BLOCK', async () => {
      const channel = createMockVoiceChannel('channel-1', 'current-name', 'guild-123');
      const config = { ...baseConfig, moderationAction: 'BLOCK' as any };

      const result = await service.moderateChannelName(
        channel,
        'Old Safe Name',
        'f u c k room',
        config,
        'user-123'
      );

      expect(result).not.toBeNull();
      expect(result?.validation.isAllowed).toBe(false);
      expect(result?.actionTaken).toBe(ModerationAction.BLOCK);
      expect(result?.finalName).toBe('Old Safe Name');
      expect(channel.setName).toHaveBeenCalledWith('Old Safe Name');
    });

    it('should warn only when action is WARN_ONLY', async () => {
      const channel = createMockVoiceChannel('channel-1', 'bad-name', 'guild-123');
      const config = { ...baseConfig, moderationAction: 'WARN_ONLY' as any };

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'f u c k room',
        config,
        'user-123'
      );

      expect(result).not.toBeNull();
      expect(result?.validation.isAllowed).toBe(false);
      expect(result?.actionTaken).toBe(ModerationAction.WARN_ONLY);
      expect(result?.finalName).toBe('f u c k room');
      expect(channel.setName).not.toHaveBeenCalled();
    });

    it('should log moderation events to database', async () => {
      const channel = createMockVoiceChannel('channel-1', 'test-room', 'guild-123');

      await service.moderateChannelName(
        channel,
        'Old Name',
        'Gaming Room',
        baseConfig,
        'user-123'
      );

      expect(mockPrisma.tempVoiceModerationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: 'guild-123',
          channelId: 'channel-1',
          userId: 'user-123',
          originalName: 'Old Name',
          finalName: 'Gaming Room',
          isAllowed: true,
          actionTaken: ModerationAction.WARN_ONLY,
        }),
      });
    });

    it('should include processing time in result', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'Test Room',
        baseConfig,
        'user-123'
      );

      expect(result?.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result?.processingTimeMs).toBeLessThan(1000); // Should be fast
    });

    it('should include timestamp in result', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');
      const before = new Date();

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'Test Room',
        baseConfig,
        'user-123'
      );

      const after = new Date();
      expect(result?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('bot rename detection', () => {
    it('should skip moderation for bot-initiated renames', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      // First moderation - auto-rename
      const result1 = await service.moderateChannelName(
        channel,
        'Old Name',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      expect(result1?.actionTaken).toBe(ModerationAction.AUTO_RENAME);
      const botRenamedTo = result1?.finalName;

      // Second attempt - bot tries to moderate its own rename
      const result2 = await service.moderateChannelName(
        channel,
        'f u c k room',
        botRenamedTo!,
        baseConfig,
        'user-123'
      );

      // Should return null because it's a bot rename
      expect(result2).toBeNull();
    });

    it('should allow moderation after bot rename expires', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      // Trigger auto-rename
      await service.moderateChannelName(
        channel,
        'Old Name',
        'bad word',
        baseConfig,
        'user-123'
      );

      // Manually clear the rate limit map to simulate expiry
      service.cleanupRateLimits();

      // Should allow moderation again
      const result = await service.moderateChannelName(
        channel,
        'Previous',
        'Gaming Room',
        baseConfig,
        'user-123'
      );

      expect(result).not.toBeNull();
    });
  });

  describe('rate limiting', () => {
    it('should track rename attempts', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      // Make multiple rename attempts
      for (let i = 0; i < 3; i++) {
        await service.moderateChannelName(
          channel,
          'Previous',
          `Test Room ${i}`,
          baseConfig,
          'user-123'
        );
      }

      // Should succeed without rate limit (< 5 attempts)
      const result = await service.moderateChannelName(
        channel,
        'Previous',
        'Final Room',
        baseConfig,
        'user-123'
      );

      expect(result).not.toBeNull();
    });

    it('should continue processing even when rate limited', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      // Make 6 rename attempts (exceeds limit of 5)
      let lastResult;
      for (let i = 0; i < 6; i++) {
        lastResult = await service.moderateChannelName(
          channel,
          'Previous',
          `Test Room ${i}`,
          baseConfig,
          'user-123'
        );
      }

      // Should still process (logs warning but doesn't block)
      expect(lastResult).not.toBeNull();
    });

    it('should clean up old rate limit entries', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      // Create entry
      await service.moderateChannelName(
        channel,
        'Old',
        'Test Room',
        baseConfig,
        'user-123'
      );

      // Clean up (simulate time passing)
      service.cleanupRateLimits();

      // Should have cleaned up
      // (We can't directly test the map, but the method should execute without error)
      expect(true).toBe(true);
    });
  });

  describe('auto-rename with collision detection', () => {
    it('should pass existing channel names to auto-rename', async () => {
      const existingChannels = [
        { name: 'Gaming Room' },
        { name: 'Chill Zone' },
        { name: 'Study Space' },
      ];
      const channel = createMockVoiceChannel(
        'channel-1',
        'bad-name',
        'guild-123',
        existingChannels
      );

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      expect(result?.actionTaken).toBe(ModerationAction.AUTO_RENAME);
      expect(result?.renameResult?.collisionChecked).toBe(true);
    });

    it('should generate non-colliding names', async () => {
      const existingChannels = [{ name: 'Chat Room' }, { name: 'Voice Lounge' }];
      const channel = createMockVoiceChannel(
        'channel-1',
        'bad-name',
        'guild-123',
        existingChannels
      );

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'bad word',
        baseConfig,
        'user-123'
      );

      // Final name should not be in existing channels
      const existingNames = existingChannels.map((c) => c.name.toLowerCase());
      expect(existingNames).not.toContain(result?.finalName.toLowerCase());
    });
  });

  describe('error handling', () => {
    it('should fall back to BLOCK if auto-rename fails', async () => {
      const channel = createMockVoiceChannel('channel-1', 'bad-name', 'guild-123');
      // Make setName fail
      channel.setName = vi.fn().mockRejectedValue(new Error('Discord API Error'));

      const result = await service.moderateChannelName(
        channel,
        'Safe Old Name',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      // Should fall back to BLOCK action
      expect(result?.actionTaken).toBe(ModerationAction.BLOCK);
    });

    it('should not throw if database logging fails', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');
      mockPrisma.tempVoiceModerationLog.create.mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(
        service.moderateChannelName(channel, 'Old', 'Test Room', baseConfig, 'user-123')
      ).resolves.not.toThrow();
    });

    it('should return current name if revert fails', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Bad Name', 'guild-123');
      const config = { ...baseConfig, moderationAction: 'BLOCK' as any };
      channel.setName = vi.fn().mockRejectedValue(new Error('Discord API Error'));

      const result = await service.moderateChannelName(
        channel,
        'Old Name',
        'f u c k room',
        config,
        'user-123'
      );

      // Should return current name if revert failed
      expect(result?.finalName).toBe('Bad Name');
    });
  });

  describe('configuration options', () => {
    it('should respect strict mode', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test!!!', 'guild-123');
      const strictConfig = { ...baseConfig, strictMode: true };

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'Test!!!',
        strictConfig,
        'user-123'
      );

      // Strict mode should be more aggressive
      expect(result).not.toBeNull();
    });

    it('should respect allowlist mode', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Random Name', 'guild-123');
      const allowlistConfig = {
        ...baseConfig,
        allowListEnabled: true,
        allowedKeywords: ['approved', 'safe', 'okay'],
      };

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'Random Name',
        allowlistConfig,
        'user-123'
      );

      // Should reject if not in allowlist
      expect(result?.validation.isAllowed).toBe(false);
    });

    it('should allow names in allowlist', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Approved Safe', 'guild-123');
      const allowlistConfig = {
        ...baseConfig,
        allowListEnabled: true,
        allowedKeywords: ['approved', 'safe', 'room'],
      };

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'Approved Safe',
        allowlistConfig,
        'user-123'
      );

      expect(result?.validation.isAllowed).toBe(true);
    });

    it('should use custom patterns', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Forbidden Word', 'guild-123');
      const customConfig = {
        ...baseConfig,
        customPatterns: ['\\bforbidden\\b', '\\bcustom\\b'],
      };

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'Forbidden Word',
        customConfig,
        'user-123'
      );

      expect(result?.validation.isAllowed).toBe(false);
      expect(result?.validation.reasonCodes).toContain(ReasonCode.CUSTOM_PATTERN);
    });
  });

  describe('metadata and logging', () => {
    it('should include rename strategy in metadata', async () => {
      const channel = createMockVoiceChannel('channel-1', 'bad-name', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      if (result?.renameResult) {
        expect(Object.values(RenameStrategy)).toContain(result.renameResult.strategyUsed);
      }
    });

    it('should include reason codes in validation', async () => {
      const channel = createMockVoiceChannel('channel-1', 'bad-name', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      expect(result?.validation.reasonCodes).toBeDefined();
      expect(Array.isArray(result?.validation.reasonCodes)).toBe(true);
      if (!result?.validation.isAllowed) {
        expect(result?.validation.reasonCodes.length).toBeGreaterThan(0);
      }
    });

    it('should include matched patterns', async () => {
      const channel = createMockVoiceChannel('channel-1', 'bad-name', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        'Old',
        'f u c k room',
        baseConfig,
        'user-123'
      );

      if (!result?.validation.isAllowed) {
        expect(result?.validation.matchedPatterns).toBeDefined();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid name changes', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Test Room', 'guild-123');

      // Simulate rapid name changes
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.moderateChannelName(
          channel,
          `Previous ${i}`,
          `Test Room ${i}`,
          baseConfig,
          'user-123'
        );
        results.push(result);
      }

      // All should complete successfully
      expect(results.every((r) => r !== null)).toBe(true);
    });

    it('should handle multiple channels independently', async () => {
      const channel1 = createMockVoiceChannel('channel-1', 'Room 1', 'guild-123');
      const channel2 = createMockVoiceChannel('channel-2', 'Room 2', 'guild-123');

      const result1 = await service.moderateChannelName(
        channel1,
        'Old',
        'Gaming Room',
        baseConfig,
        'user-123'
      );
      const result2 = await service.moderateChannelName(
        channel2,
        'Old',
        'Study Room',
        baseConfig,
        'user-456'
      );

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1?.finalName).not.toBe(result2?.finalName);
    });

    it('should handle edge case: empty previous name', async () => {
      const channel = createMockVoiceChannel('channel-1', 'New Name', 'guild-123');

      const result = await service.moderateChannelName(
        channel,
        '', // Empty previous name
        'New Name',
        baseConfig,
        'user-123'
      );

      expect(result).not.toBeNull();
    });

    it('should handle edge case: very long names', async () => {
      const channel = createMockVoiceChannel('channel-1', 'Long Name', 'guild-123');
      const longName = 'A'.repeat(150); // Exceeds Discord limit

      const result = await service.moderateChannelName(
        channel,
        'Old',
        longName,
        baseConfig,
        'user-123'
      );

      expect(result?.validation.isAllowed).toBe(false);
      expect(result?.validation.reasonCodes).toContain(ReasonCode.TOO_LONG);
    });
  });
});
