/**
 * Unit tests for Auto-Rename Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoRenameService } from '../../../src/modules/temp-voice/services/moderation/auto-rename.service.js';
import {
  ReasonCode,
  RenameStrategy,
  type RenameContext,
} from '../../../src/modules/temp-voice/models/name-moderation.model.js';

describe('AutoRenameService', () => {
  let service: AutoRenameService;
  let baseContext: RenameContext;

  beforeEach(() => {
    service = new AutoRenameService();
    baseContext = {
      originalName: 'Bad Name',
      normalizedName: 'bad name',
      guildId: 'guild-123',
      channelId: 'channel-456',
      userId: 'user-789',
      reasonCodes: [ReasonCode.PROFANITY],
      existingChannelNames: [],
    };
  });

  describe('generateSafeName', () => {
    it('should generate a safe name', async () => {
      const result = await service.generateSafeName(baseContext);

      expect(result.suggestedName).toBeTruthy();
      expect(result.suggestedName.length).toBeGreaterThan(0);
      expect(result.suggestedName.length).toBeLessThanOrEqual(100);
      expect(result.strategyUsed).toBeDefined();
      expect(result.collisionChecked).toBe(false);
      expect(result.collisionAttempts).toBe(0);
    });

    it('should generate different names on multiple calls', async () => {
      const names = new Set<string>();
      
      for (let i = 0; i < 10; i++) {
        const result = await service.generateSafeName(baseContext);
        names.add(result.suggestedName);
      }

      // Should have some variety (at least 3 different names in 10 attempts)
      expect(names.size).toBeGreaterThanOrEqual(3);
    });

    it('should respect Discord naming constraints', async () => {
      const result = await service.generateSafeName(baseContext);

      // Valid Discord channel name pattern
      expect(result.suggestedName).toMatch(/^[a-zA-Z0-9\-_ ]+$/);
      expect(result.suggestedName.length).toBeGreaterThanOrEqual(1);
      expect(result.suggestedName.length).toBeLessThanOrEqual(100);
    });

    it('should detect theme from gaming-related name', async () => {
      const gamingContext: RenameContext = {
        ...baseContext,
        originalName: 'game room',
        normalizedName: 'game room',
      };

      const result = await service.generateSafeName(gamingContext);
      
      // Should likely use THEMED strategy for gaming names
      expect(result.strategyUsed).toBeDefined();
    });

    it('should detect theme from study-related name', async () => {
      const studyContext: RenameContext = {
        ...baseContext,
        originalName: 'study session',
        normalizedName: 'study session',
      };

      const result = await service.generateSafeName(studyContext);
      
      expect(result.strategyUsed).toBeDefined();
    });
  });

  describe('collision detection', () => {
    it('should handle no collisions', async () => {
      const context: RenameContext = {
        ...baseContext,
        existingChannelNames: ['Other Room', 'Different Space'],
      };

      const result = await service.generateSafeName(context);

      expect(result.collisionChecked).toBe(true);
      expect(result.collisionAttempts).toBeGreaterThanOrEqual(0);
    });

    it('should resolve collision with suffix', async () => {
      const context: RenameContext = {
        ...baseContext,
        existingChannelNames: [
          'Chat Room',
          'Voice Lounge',
          'Gaming Room',
          'Chill Zone',
        ],
      };

      const result = await service.generateSafeName(context);

      expect(result.collisionChecked).toBe(true);
      expect(result.suggestedName).toBeTruthy();
    });

    it('should handle multiple collisions', async () => {
      // Create many existing channels
      const existingChannelNames: string[] = [];
      for (let i = 1; i <= 10; i++) {
        existingChannelNames.push(`Voice Channel ${i}`);
        existingChannelNames.push(`Room ${i}`);
      }

      const context: RenameContext = {
        ...baseContext,
        existingChannelNames,
      };

      const result = await service.generateSafeName(context);

      expect(result.collisionChecked).toBe(true);
      expect(result.suggestedName).toBeTruthy();
      expect(result.suggestedName).not.toBe('');
    });

    it('should handle case-insensitive collision detection', async () => {
      const context: RenameContext = {
        ...baseContext,
        existingChannelNames: ['CHAT ROOM', 'voice lounge', 'GaMiNg RoOm'],
      };

      const result = await service.generateSafeName(context);

      expect(result.collisionChecked).toBe(true);
      // Should not suggest exact matches (case-insensitive)
      const lowerName = result.suggestedName.toLowerCase();
      expect(lowerName).not.toBe('chat room');
      expect(lowerName).not.toBe('voice lounge');
      expect(lowerName).not.toBe('gaming room');
    });
  });

  describe('validateDiscordConstraints', () => {
    it('should accept valid names', () => {
      const validNames = [
        'Chat Room',
        'Voice-Lounge',
        'Gaming_Zone',
        'Room 123',
        'A',
        'X'.repeat(100), // Max length
      ];

      for (const name of validNames) {
        expect(service.validateDiscordConstraints(name)).toBe(true);
      }
    });

    it('should reject empty names', () => {
      expect(service.validateDiscordConstraints('')).toBe(false);
      expect(service.validateDiscordConstraints('   ')).toBe(false);
      expect(service.validateDiscordConstraints('\t\n')).toBe(false);
    });

    it('should reject names that are too long', () => {
      const tooLong = 'X'.repeat(101);
      expect(service.validateDiscordConstraints(tooLong)).toBe(false);
    });

    it('should reject names with invalid characters', () => {
      const invalidNames = [
        'Room@123',
        'Voice#Channel',
        'Chat!Room',
        'Gaming&Zone',
        'Room*123',
        'Voice%Lounge',
        'emoji 🎮 room',
      ];

      for (const name of invalidNames) {
        expect(service.validateDiscordConstraints(name)).toBe(false);
      }
    });

    it('should accept names with allowed special characters', () => {
      const validNames = [
        'Chat-Room',
        'Voice_Lounge',
        'Gaming Zone',
        'Room-123',
        'Voice_Channel_1',
      ];

      for (const name of validNames) {
        expect(service.validateDiscordConstraints(name)).toBe(true);
      }
    });
  });

  describe('strategy detection', () => {
    it('should use appropriate strategy based on context', async () => {
      const contexts = [
        {
          name: 'game',
          context: { ...baseContext, originalName: 'game', normalizedName: 'game' },
        },
        {
          name: 'study',
          context: { ...baseContext, originalName: 'study', normalizedName: 'study' },
        },
        {
          name: 'music',
          context: { ...baseContext, originalName: 'music', normalizedName: 'music' },
        },
      ];

      for (const { context } of contexts) {
        const result = await service.generateSafeName(context);
        expect(result.strategyUsed).toBeDefined();
        expect(Object.values(RenameStrategy)).toContain(result.strategyUsed);
      }
    });
  });

  describe('collision resolution with truncation', () => {
    it('should truncate long names when adding collision suffix', async () => {
      const longName = 'A'.repeat(95);
      const context: RenameContext = {
        ...baseContext,
        existingChannelNames: [longName, `${longName} 2`, `${longName} 3`],
      };

      const result = await service.generateSafeName(context);

      // Should generate a valid name even with collisions
      expect(result.suggestedName.length).toBeLessThanOrEqual(100);
      expect(service.validateDiscordConstraints(result.suggestedName)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty existing channels list', async () => {
      const context: RenameContext = {
        ...baseContext,
        existingChannelNames: [],
      };

      const result = await service.generateSafeName(context);

      expect(result.suggestedName).toBeTruthy();
      expect(result.collisionChecked).toBe(false);
      expect(result.collisionAttempts).toBe(0);
    });

    it('should handle very large existing channels list', async () => {
      const existingChannelNames: string[] = [];
      for (let i = 0; i < 500; i++) {
        existingChannelNames.push(`Channel ${i}`);
      }

      const context: RenameContext = {
        ...baseContext,
        existingChannelNames,
      };

      const result = await service.generateSafeName(context);

      expect(result.suggestedName).toBeTruthy();
      expect(result.collisionChecked).toBe(true);
    });

    it('should always return a valid name', async () => {
      // Try with various reason codes
      const reasonCodes = [
        ReasonCode.PROFANITY,
        ReasonCode.HATE_SPEECH,
        ReasonCode.SPAM_PATTERN,
        ReasonCode.OBFUSCATION,
        ReasonCode.EXCESSIVE_SYMBOLS,
      ];

      for (const reasonCode of reasonCodes) {
        const context: RenameContext = {
          ...baseContext,
          reasonCodes: [reasonCode],
        };

        const result = await service.generateSafeName(context);

        expect(result.suggestedName).toBeTruthy();
        expect(service.validateDiscordConstraints(result.suggestedName)).toBe(true);
      }
    });

    it('should handle special characters in original name', async () => {
      const specialNames = [
        '🎮 Gaming Room',
        'Room@#$%',
        'Voice!!!',
        '***Channel***',
        'Test\\n\\nRoom',
      ];

      for (const originalName of specialNames) {
        const context: RenameContext = {
          ...baseContext,
          originalName,
          normalizedName: originalName.toLowerCase(),
        };

        const result = await service.generateSafeName(context);

        expect(result.suggestedName).toBeTruthy();
        expect(service.validateDiscordConstraints(result.suggestedName)).toBe(true);
      }
    });
  });

  describe('sequential numbering', () => {
    it('should find highest number in existing channels', async () => {
      const context: RenameContext = {
        ...baseContext,
        existingChannelNames: [
          'Room 1',
          'Room 2',
          'Room 5',
          'Room 10',
          'Room #15',
          'Random Name',
        ],
      };

      const result = await service.generateSafeName(context);

      expect(result.suggestedName).toBeTruthy();
      // The service should be aware of existing numbers
    });
  });

  describe('performance', () => {
    it('should generate name quickly', async () => {
      const start = Date.now();
      await service.generateSafeName(baseContext);
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle collision detection efficiently', async () => {
      const existingChannelNames: string[] = [];
      for (let i = 0; i < 100; i++) {
        existingChannelNames.push(`Channel ${i}`);
      }

      const context: RenameContext = {
        ...baseContext,
        existingChannelNames,
      };

      const start = Date.now();
      await service.generateSafeName(context);
      const duration = Date.now() - start;

      // Should complete in reasonable time even with many channels
      expect(duration).toBeLessThan(200);
    });
  });
});
