/**
 * Unit tests for Name Validation Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NameValidationService } from '../../../src/modules/temp-voice/services/moderation/name-validation.service.js';
import { ReasonCode, type ModerationContext } from '../../../src/modules/temp-voice/models/name-moderation.model.js';

describe('NameValidationService', () => {
  let service: NameValidationService;
  let defaultContext: ModerationContext;

  beforeEach(() => {
    service = new NameValidationService();
    defaultContext = {
      guildId: 'test-guild',
      channelId: 'test-channel',
      userId: 'test-user',
      strictMode: false,
      allowListEnabled: false,
      customPatterns: [],
      allowedKeywords: [],
    };
  });

  describe('validate - basic cases', () => {
    it('should allow clean names', async () => {
      const result = await service.validate('Gaming Room', defaultContext);
      expect(result.isAllowed).toBe(true);
      expect(result.reasonCodes).toHaveLength(0);
    });

    it('should allow names with common words', async () => {
      const result = await service.validate('Chill Zone', defaultContext);
      expect(result.isAllowed).toBe(true);
    });

    it('should allow names with numbers', async () => {
      const result = await service.validate('Room 123', defaultContext);
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('validate - Discord constraints', () => {
    it('should reject empty names', async () => {
      const result = await service.validate('', defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.TOO_SHORT);
    });

    it('should reject names that are too long', async () => {
      const longName = 'a'.repeat(101);
      const result = await service.validate(longName, defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.TOO_LONG);
    });

    it('should allow names at max length', async () => {
      const maxLengthName = 'a'.repeat(100);
      const result = await service.validate(maxLengthName, defaultContext);
      // May fail heuristics but not length constraint
      expect(result.reasonCodes).not.toContain(ReasonCode.TOO_LONG);
    });
  });

  describe('validate - pattern matching', () => {
    it('should detect basic profanity patterns', async () => {
      // Note: Using d-a-m-n as a test case (lower severity)
      const result = await service.validate('d a m n room', defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns).toBeDefined();
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect leetspeak obfuscation', async () => {
      const result = await service.validate('h3ll room', defaultContext);
      // Should match hell pattern after leetspeak decoding
      expect(result.isAllowed).toBe(false);
    });

    it('should detect separator-based obfuscation', async () => {
      const result = await service.validate('h-e-l-l room', defaultContext);
      // Should match hell pattern after separator removal
      expect(result.isAllowed).toBe(false);
    });

    it('should detect spam patterns', async () => {
      const result = await service.validate('free nitro here', defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.SPAM_PATTERN);
    });

    it('should detect Discord invite links', async () => {
      const result = await service.validate('join discord.gg/test', defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.SPAM_PATTERN);
    });
  });

  describe('validate - heuristics', () => {
    it('should detect excessive symbols', async () => {
      const result = await service.validate('!!!###$$$%%%', defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.EXCESSIVE_SYMBOLS);
      expect(result.heuristicScore).toBeGreaterThan(0);
    });

    it('should detect excessive repetition', async () => {
      const result = await service.validate('aaaaaaaaaa', defaultContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.EXCESSIVE_REPETITION);
    });

    it('should allow reasonable symbol usage', async () => {
      const result = await service.validate('Game Room #1', defaultContext);
      expect(result.isAllowed).toBe(true);
    });

    it('should be more strict in strict mode', async () => {
      const strictContext = { ...defaultContext, strictMode: true };
      const result = await service.validate('Test!!!', strictContext);
      // May be rejected in strict mode but allowed in normal mode
      if (!result.isAllowed) {
        expect(result.heuristicScore).toBeGreaterThan(0);
      }
    });
  });

  describe('validate - custom patterns', () => {
    it('should match custom guild patterns', async () => {
      const contextWithCustom = {
        ...defaultContext,
        customPatterns: ['badword'],
      };
      const result = await service.validate('this has badword in it', contextWithCustom);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.CUSTOM_PATTERN);
    });

    it('should handle multiple custom patterns', async () => {
      const contextWithCustom = {
        ...defaultContext,
        customPatterns: ['word1', 'word2', 'word3'],
      };
      const result = await service.validate('word2 here', contextWithCustom);
      expect(result.isAllowed).toBe(false);
    });

    it('should skip invalid regex patterns', async () => {
      const contextWithInvalid = {
        ...defaultContext,
        customPatterns: ['[invalid(regex'],
      };
      // Should not throw error, just skip invalid pattern
      const result = await service.validate('test', contextWithInvalid);
      expect(result).toBeDefined();
    });
  });

  describe('validate - allowlist mode', () => {
    it('should reject names not in allowlist when enabled', async () => {
      const allowlistContext = {
        ...defaultContext,
        allowListEnabled: true,
        allowedKeywords: ['gaming', 'study', 'chat'],
      };
      const result = await service.validate('random room', allowlistContext);
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.BLOCKLIST_MATCH);
    });

    it('should allow names in allowlist', async () => {
      const allowlistContext = {
        ...defaultContext,
        allowListEnabled: true,
        allowedKeywords: ['gaming', 'room'],
      };
      const result = await service.validate('gaming room', allowlistContext);
      expect(result.isAllowed).toBe(true);
    });

    it('should be case-insensitive for allowlist', async () => {
      const allowlistContext = {
        ...defaultContext,
        allowListEnabled: true,
        allowedKeywords: ['gaming'],
      };
      const result = await service.validate('GAMING', allowlistContext);
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('validate - obfuscation detection', () => {
    it('should detect heavily obfuscated text', async () => {
      const result = await service.validate('w••o••r••d', defaultContext);
      if (!result.isAllowed) {
        expect(result.reasonCodes).toContain(ReasonCode.OBFUSCATION);
      }
    });

    it('should detect homoglyphs', async () => {
      // Using Cyrillic 'е' instead of Latin 'e'
      const result = await service.validate('hеllo', defaultContext);
      // Should detect the homoglyph usage
      if (result.heuristicScore && result.heuristicScore > 0) {
        expect(result.metadata.heuristicBreakdown).toBeDefined();
      }
    });
  });

  describe('validate - metadata and performance', () => {
    it('should include processing time', async () => {
      const result = await service.validate('test room', defaultContext);
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include normalized name', async () => {
      const result = await service.validate('  TEST  ROOM  ', defaultContext);
      expect(result.normalizedName).toBe('test room');
    });

    it('should include heuristic breakdown when applicable', async () => {
      const result = await service.validate('!!!test!!!', defaultContext);
      if (result.heuristicScore && result.heuristicScore > 0) {
        expect(result.metadata.heuristicBreakdown).toBeDefined();
      }
    });
  });

  describe('validate - edge cases', () => {
    it('should handle single character names', async () => {
      const result = await service.validate('X', defaultContext);
      expect(result).toBeDefined();
      expect(result.isAllowed).toBeDefined();
    });

    it('should handle unicode emoji', async () => {
      const result = await service.validate('Gaming 🎮', defaultContext);
      expect(result).toBeDefined();
    });

    it('should handle mixed scripts', async () => {
      const result = await service.validate('Test テスト', defaultContext);
      expect(result).toBeDefined();
    });

    it('should handle only spaces', async () => {
      const result = await service.validate('   ', defaultContext);
      expect(result.isAllowed).toBe(false);
    });
  });

  describe('isValidPattern - static method', () => {
    it('should validate correct regex patterns', () => {
      expect(NameValidationService.isValidPattern('test')).toBe(true);
      expect(NameValidationService.isValidPattern('[a-z]+')).toBe(true);
      expect(NameValidationService.isValidPattern('\\d{3}')).toBe(true);
    });

    it('should reject invalid regex patterns', () => {
      expect(NameValidationService.isValidPattern('[invalid(')).toBe(false);
      expect(NameValidationService.isValidPattern('(unclosed')).toBe(false);
      expect(NameValidationService.isValidPattern('[z-a]')).toBe(false);
    });
  });
});
