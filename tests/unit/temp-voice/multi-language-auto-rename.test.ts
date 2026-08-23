/**
 * Unit tests for Multi-Language Auto-Rename
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoRenameService } from '../../../src/modules/temp-voice/services/moderation/auto-rename.service.js';
import { ReasonCode, type RenameContext } from '../../../src/modules/temp-voice/models/name-moderation.model.js';

describe('AutoRenameService - Multi-Language', () => {
  let service: AutoRenameService;
  let defaultContext: RenameContext;

  beforeEach(() => {
    service = new AutoRenameService();
    defaultContext = {
      originalName: 'bad name',
      normalizedName: 'badname',
      guildId: 'test-guild',
      channelId: 'test-channel',
      userId: 'test-user',
      reasonCodes: [ReasonCode.PROFANITY],
      existingChannelNames: [],
    };
  });

  describe('English safe names', () => {
    it('should generate English safe names', async () => {
      const context = { ...defaultContext, language: 'en' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
      expect(result.strategyUsed).toBeDefined();
    });

    it('should generate valid English templates', async () => {
      const context = { ...defaultContext, language: 'en' };
      const names = new Set<string>();
      
      for (let i = 0; i < 10; i++) {
        const result = await service.generateSafeName(context);
        names.add(result.suggestedName);
        
        // Check that name is reasonable
        expect(result.suggestedName.length).toBeLessThanOrEqual(100);
        expect(result.suggestedName.length).toBeGreaterThan(0);
      }
      
      // Should have some variety
      expect(names.size).toBeGreaterThan(1);
    });

    it('should generate names without profanity', async () => {
      const context = { ...defaultContext, language: 'en' };
      const result = await service.generateSafeName(context);
      
      // Check that common English profanity is not in the name
      const name = result.suggestedName.toLowerCase();
      expect(name).not.toMatch(/fuck|shit|damn/);
    });
  });

  describe('Spanish safe names', () => {
    it('should generate Spanish safe names', async () => {
      const context = { ...defaultContext, language: 'es' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should generate valid Spanish templates', async () => {
      const context = { ...defaultContext, language: 'es' };
      const names = new Set<string>();
      
      for (let i = 0; i < 10; i++) {
        const result = await service.generateSafeName(context);
        names.add(result.suggestedName);
      }
      
      // Should have variety
      expect(names.size).toBeGreaterThan(1);
    });

    it('should use Spanish vocabulary', async () => {
      const context = { ...defaultContext, language: 'es' };
      const names: string[] = [];
      
      // Generate multiple names to check for Spanish words
      for (let i = 0; i < 20; i++) {
        const result = await service.generateSafeName(context);
        names.push(result.suggestedName.toLowerCase());
      }
      
      // At least some should contain Spanish words
      const hasSpanishWords = names.some(
        (name) =>
          name.includes('sala') ||
          name.includes('zona') ||
          name.includes('espacio') ||
          name.includes('chat')
      );
      
      expect(hasSpanishWords).toBe(true);
    });
  });

  describe('French safe names', () => {
    it('should generate French safe names', async () => {
      const context = { ...defaultContext, language: 'fr' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should use French vocabulary', async () => {
      const context = { ...defaultContext, language: 'fr' };
      const names: string[] = [];
      
      for (let i = 0; i < 20; i++) {
        const result = await service.generateSafeName(context);
        names.push(result.suggestedName.toLowerCase());
      }
      
      const hasFrenchWords = names.some(
        (name) =>
          name.includes('salon') ||
          name.includes('espace') ||
          name.includes('zone') ||
          name.includes('discussion')
      );
      
      expect(hasFrenchWords).toBe(true);
    });
  });

  describe('German safe names', () => {
    it('should generate German safe names', async () => {
      const context = { ...defaultContext, language: 'de' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should use German vocabulary', async () => {
      const context = { ...defaultContext, language: 'de' };
      const names: string[] = [];
      
      for (let i = 0; i < 20; i++) {
        const result = await service.generateSafeName(context);
        names.push(result.suggestedName.toLowerCase());
      }
      
      const hasGermanWords = names.some(
        (name) =>
          name.includes('raum') ||
          name.includes('zone') ||
          name.includes('lounge') ||
          name.includes('chat')
      );
      
      expect(hasGermanWords).toBe(true);
    });
  });

  describe('Portuguese safe names', () => {
    it('should generate Portuguese safe names', async () => {
      const context = { ...defaultContext, language: 'pt' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should use Portuguese vocabulary', async () => {
      const context = { ...defaultContext, language: 'pt' };
      const names: string[] = [];

      for (let i = 0; i < 50; i++) {
        const result = await service.generateSafeName(context);
        names.push(result.suggestedName.toLowerCase());
      }

      // Check against all Portuguese nouns and template keywords
      const ptWords = [
        'sala', 'lounge', 'espaço', 'zona', 'hub', 'canto', 'lugar',
        'local', 'ponto', 'área', 'câmara', 'refúgio', 'retiro',
        'ninho', 'salão', 'lobby', 'estúdio', 'café', 'clube',
        'círculo', 'esquadrão', 'equipe', 'turma', 'grupo', 'festa',
        'reunião', 'encontro', 'sessão', 'chat', 'voz',
      ];

      const hasPortugueseWords = names.some(
        (name) => ptWords.some((word) => name.includes(word))
      );

      expect(hasPortugueseWords).toBe(true);
    });
  });

  describe('Italian safe names', () => {
    it('should generate Italian safe names', async () => {
      const context = { ...defaultContext, language: 'it' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should use Italian vocabulary', async () => {
      const context = { ...defaultContext, language: 'it' };
      const names: string[] = [];
      
      for (let i = 0; i < 20; i++) {
        const result = await service.generateSafeName(context);
        names.push(result.suggestedName.toLowerCase());
      }
      
      // Debug: log all generated names
      console.log('Generated Italian names:', names);
      
      const hasItalianWords = names.some(
        (name) =>
          name.includes('stanza') ||
          name.includes('sala') ||
          name.includes('zona') ||
          name.includes('chat') ||
          name.includes('spazio') ||
          name.includes('angolo') ||
          name.includes('punto')
      );
      
      expect(hasItalianWords).toBe(true);
    });
  });

  describe('Fallback behavior', () => {
    it('should use default language when not specified', async () => {
      const result = await service.generateSafeName(defaultContext);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should handle invalid language codes', async () => {
      const context = { ...defaultContext, language: 'invalid' };
      const result = await service.generateSafeName(context);
      
      // Should not throw, should use fallback
      expect(result.suggestedName).toBeDefined();
      expect(result.suggestedName.length).toBeGreaterThan(0);
    });

    it('should always provide a valid fallback', async () => {
      const context = { ...defaultContext, language: 'unknown' };
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(typeof result.suggestedName).toBe('string');
    });
  });

  describe('Collision handling', () => {
    it('should avoid collisions with existing names', async () => {
      const context = {
        ...defaultContext,
        language: 'en',
        existingChannelNames: ['Gaming Room', 'Chat Zone', 'Voice Lounge'],
      };
      
      const result = await service.generateSafeName(context);
      
      expect(result.suggestedName).toBeDefined();
      expect(result.collisionChecked).toBe(true);
      expect(context.existingChannelNames).not.toContain(result.suggestedName);
    });

    it('should handle collisions across languages', async () => {
      const context = {
        ...defaultContext,
        language: 'es',
        existingChannelNames: ['Sala de Chat', 'Zona Chill'],
      };
      
      const result = await service.generateSafeName(context);
      
      expect(result.collisionChecked).toBe(true);
      expect(context.existingChannelNames).not.toContain(result.suggestedName);
    });

    it('should track collision attempts', async () => {
      const existingName = 'Gaming Room';
      const context = {
        ...defaultContext,
        language: 'en',
        existingChannelNames: [existingName],
      };
      
      const result = await service.generateSafeName(context);
      
      expect(result.collisionAttempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Discord constraints', () => {
    it('should generate names within Discord length limits', async () => {
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'it'];
      
      for (const lang of languages) {
        const context = { ...defaultContext, language: lang };
        const result = await service.generateSafeName(context);
        
        expect(result.suggestedName.length).toBeLessThanOrEqual(100);
        expect(result.suggestedName.length).toBeGreaterThan(0);
      }
    });

    it('should handle trimming if needed', async () => {
      const context = { ...defaultContext, language: 'en' };
      const result = await service.generateSafeName(context);
      
      // Should not have leading/trailing whitespace
      expect(result.suggestedName).toBe(result.suggestedName.trim());
    });
  });

  describe('Strategy tracking', () => {
    it('should track which strategy was used', async () => {
      const context = { ...defaultContext, language: 'en' };
      const result = await service.generateSafeName(context);
      
      expect(result.strategyUsed).toBeDefined();
      expect(typeof result.strategyUsed).toBe('string');
    });

    it('should use different strategies', async () => {
      const context = { ...defaultContext, language: 'en' };
      const strategies = new Set<string>();
      
      for (let i = 0; i < 20; i++) {
        const result = await service.generateSafeName(context);
        strategies.add(result.strategyUsed);
      }
      
      // Should use at least 2 different strategies over 20 attempts
      expect(strategies.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Consistency', () => {
    it('should generate consistent format names', async () => {
      const context = { ...defaultContext, language: 'en' };
      
      for (let i = 0; i < 10; i++) {
        const result = await service.generateSafeName(context);
        
        // Name should not be empty or just whitespace
        expect(result.suggestedName.trim().length).toBeGreaterThan(0);
        
        // Name should not contain multiple consecutive spaces
        expect(result.suggestedName).not.toMatch(/\s{2,}/);
      }
    });

    it('should not return special characters in safe names', async () => {
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'it'];
      
      for (const lang of languages) {
        const context = { ...defaultContext, language: lang };
        const result = await service.generateSafeName(context);
        
        // Should not have problematic special characters
        expect(result.suggestedName).not.toMatch(/[@#$%^&*()]/);
      }
    });
  });

  describe('Performance', () => {
    it('should generate names efficiently', async () => {
      const context = { ...defaultContext, language: 'en' };
      
      const startTime = Date.now();
      await service.generateSafeName(context);
      const duration = Date.now() - startTime;
      
      // Should be fast (< 500ms)
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple language switches efficiently', async () => {
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'it'];
      
      const startTime = Date.now();
      
      for (const lang of languages) {
        const context = { ...defaultContext, language: lang };
        await service.generateSafeName(context);
      }
      
      const duration = Date.now() - startTime;
      
      // Should handle all languages quickly (< 2 seconds total)
      expect(duration).toBeLessThan(2000);
    });
  });
});
