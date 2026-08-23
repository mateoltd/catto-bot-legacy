/**
 * Unit tests for Multi-Language Name Validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NameValidationService } from '../../../src/modules/temp-voice/services/moderation/name-validation.service.js';
import { ReasonCode, type ModerationContext } from '../../../src/modules/temp-voice/models/name-moderation.model.js';

// Mock re2-wasm to avoid WASM OOM issues in tests
// The re2-wasm library uses WASM with a 16MB memory limit that fails in Vitest
vi.mock('re2-wasm', () => ({
  RE2: class MockRE2 {
    private source: string;
    private flags: string;

    constructor(source: string, flags: string) {
      this.source = source;
      this.flags = flags;
    }

    exec(text: string): RegExpExecArray | null {
      if (!text || !this.source) return null;
      
      try {
        // Create a JavaScript RegExp from the RE2 pattern and flags
        // RE2 patterns are compatible with JavaScript regex for most cases
        const jsRegex = new RegExp(this.source, this.flags);
        const match = jsRegex.exec(text);
        
        if (match) {
          // Convert to RegExpExecArray format expected by the service
          return Object.assign([...match], {
            index: match.index,
            input: match.input,
            groups: match.groups
          }) as RegExpExecArray;
        }
        
        return null;
      } catch (error) {
        // If regex is invalid or incompatible, return null
        return null;
      }
    }
  }
}));

describe('NameValidationService - Multi-Language', () => {
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

  describe('English language patterns', () => {
    it('should detect English profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('d a m n room', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect English spam patterns', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('free nitro here', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.SPAM_PATTERN);
    });

    it('should allow clean English names', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('Gaming Room', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Spanish language patterns', () => {
    it('should detect Spanish profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      // Using a mild Spanish word for testing
      const result = await service.validate('sala mierda', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect Spanish spam patterns', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('nitro gratis aqui', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.SPAM_PATTERN);
    });

    it('should allow clean Spanish names', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('Sala de Juegos', context);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should handle Spanish accented characters', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('Conversación Amigable', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('French language patterns', () => {
    it('should detect French profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'fr' };
      const result = await service.validate('salon merde', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should allow clean French names', async () => {
      const context = { ...defaultContext, primaryLanguage: 'fr' };
      const result = await service.validate('Salon de Jeu', context);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should handle French accented characters', async () => {
      const context = { ...defaultContext, primaryLanguage: 'fr' };
      const result = await service.validate('Café Agréable', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('German language patterns', () => {
    it('should detect German profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'de' };
      const result = await service.validate('raum scheiße', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should allow clean German names', async () => {
      const context = { ...defaultContext, primaryLanguage: 'de' };
      const result = await service.validate('Spielraum', context);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should handle German special characters', async () => {
      const context = { ...defaultContext, primaryLanguage: 'de' };
      const result = await service.validate('Gemütlicher Raum', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Portuguese language patterns', () => {
    it('should detect Portuguese profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'pt' };
      const result = await service.validate('sala merda', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should allow clean Portuguese names', async () => {
      const context = { ...defaultContext, primaryLanguage: 'pt' };
      const result = await service.validate('Sala de Jogos', context);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should handle Portuguese accented characters', async () => {
      const context = { ...defaultContext, primaryLanguage: 'pt' };
      const result = await service.validate('Conversa Amável', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Italian language patterns', () => {
    it('should detect Italian profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'it' };
      const result = await service.validate('sala merda', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should allow clean Italian names', async () => {
      const context = { ...defaultContext, primaryLanguage: 'it' };
      const result = await service.validate('Sala Giochi', context);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should handle Italian accented characters', async () => {
      const context = { ...defaultContext, primaryLanguage: 'it' };
      const result = await service.validate('Città Bella', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Multi-language detection', () => {
    it('should check multiple languages', async () => {
      const context = {
        ...defaultContext,
        primaryLanguage: 'en',
        additionalLanguages: ['es', 'fr'],
      };
      
      // Should detect Spanish profanity even with English primary
      const result = await service.validate('room mierda', context);
      
      expect(result.isAllowed).toBe(false);
    });

    it('should check all specified languages', async () => {
      const context = {
        ...defaultContext,
        primaryLanguage: 'en',
        additionalLanguages: ['es', 'fr', 'de'],
      };
      
      const result = await service.validate('Gaming Room', context);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should not duplicate pattern checks', async () => {
      const context = {
        ...defaultContext,
        primaryLanguage: 'en',
        additionalLanguages: ['en'], // Duplicate
      };
      
      const result = await service.validate('test room', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Language-agnostic patterns', () => {
    it('should always check obfuscation patterns', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      // Alternating case obfuscation
      const result = await service.validate('TeSt RoOm', context);
      
      // Should not fail on simple alternating case for short text
      expect(result).toBeDefined();
    });

    it('should always check invalid character patterns', async () => {
      const context = { ...defaultContext, primaryLanguage: 'fr' };
      const result = await service.validate('Test\u0000Room', context);
      
      // Should detect control characters regardless of language
      expect(result.isAllowed).toBe(false);
      expect(result.reasonCodes).toContain(ReasonCode.INVALID_CHARACTERS);
    });

    it('should check Discord invite links in all languages', async () => {
      const contexts = [
        { ...defaultContext, primaryLanguage: 'en' },
        { ...defaultContext, primaryLanguage: 'es' },
        { ...defaultContext, primaryLanguage: 'fr' },
      ];
      
      for (const context of contexts) {
        const result = await service.validate('join discord.gg/test', context);
        expect(result.isAllowed).toBe(false);
        expect(result.reasonCodes).toContain(ReasonCode.SPAM_PATTERN);
      }
    });
  });

  describe('Fallback behavior', () => {
    it('should work without language specified', async () => {
      const result = await service.validate('Gaming Room', defaultContext);
      
      expect(result.isAllowed).toBe(true);
    });

    it('should handle invalid language codes gracefully', async () => {
      const context = { ...defaultContext, primaryLanguage: 'invalid' };
      const result = await service.validate('Gaming Room', context);
      
      // Should not throw, should use fallback
      expect(result).toBeDefined();
    });

    it('should handle empty additional languages', async () => {
      const context = {
        ...defaultContext,
        primaryLanguage: 'en',
        additionalLanguages: [],
      };
      
      const result = await service.validate('Gaming Room', context);
      
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Plural and inflected forms', () => {
    it('should detect Spanish plural profanity (putas)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('entren las putas', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect Spanish plural profanity (cabrones)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('sala cabrones', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect Spanish plural profanity (pendejos)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('los pendejos', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect English plural profanity (bitches)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('room bitches', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect English inflected profanity (fucking)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('fucking room', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect French plural profanity (putes)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'fr' };
      const result = await service.validate('salon des putes', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect Portuguese plural profanity (putas)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'pt' };
      const result = await service.validate('sala putas', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect Italian plural profanity (stronzi)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'it' };
      const result = await service.validate('sala stronzi', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect German plural profanity (Schlampen)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'de' };
      const result = await service.validate('raum schlampen', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect Spanish plural hate speech (zorras)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('las zorras', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });

    it('should detect English plural hate speech (whores)', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('room whores', context);
      
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPatterns!.length).toBeGreaterThan(0);
    });
  });

  describe('Leetspeak handling across languages', () => {
    it('should detect obfuscated English profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('h3ll room', context);
      
      expect(result.isAllowed).toBe(false);
    });

    it('should detect obfuscated Spanish profanity', async () => {
      const context = { ...defaultContext, primaryLanguage: 'es' };
      const result = await service.validate('m13rd4', context);
      
      expect(result.isAllowed).toBe(false);
    });

    it('should handle separator-based obfuscation', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      const result = await service.validate('h-e-l-l room', context);
      
      expect(result.isAllowed).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle multi-language validation efficiently', async () => {
      const context = {
        ...defaultContext,
        primaryLanguage: 'en',
        additionalLanguages: ['es', 'fr', 'de', 'pt', 'it'],
      };
      
      const startTime = Date.now();
      await service.validate('Gaming Room', context);
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should cache pattern loading', async () => {
      const context = { ...defaultContext, primaryLanguage: 'en' };
      
      // First call
      await service.validate('Test Room 1', context);
      
      // Second call should be faster (patterns cached)
      const startTime = Date.now();
      await service.validate('Test Room 2', context);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500);
    });
  });
});
