/**
 * Unit tests for Pattern Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatternRegistry } from '../../../src/modules/temp-voice/constants/patterns/patterns-registry.js';

describe('PatternRegistry', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry();
    registry.clearCache(); // Ensure clean state
  });

  describe('getPatterns', () => {
    it('should load English patterns', async () => {
      const patterns = await registry.getPatterns('en');
      
      expect(patterns).toBeDefined();
      expect(patterns.profanity).toBeDefined();
      expect(patterns.hateSpech).toBeDefined();
      expect(patterns.spam).toBeDefined();
      
      expect(patterns.profanity.length).toBeGreaterThan(0);
      expect(patterns.hateSpech.length).toBeGreaterThan(0);
      expect(patterns.spam.length).toBeGreaterThan(0);
    });

    it('should load Spanish patterns', async () => {
      const patterns = await registry.getPatterns('es');
      
      expect(patterns).toBeDefined();
      expect(patterns.profanity.length).toBeGreaterThan(0);
      expect(patterns.hateSpech.length).toBeGreaterThan(0);
      expect(patterns.spam.length).toBeGreaterThan(0);
    });

    it('should load French patterns', async () => {
      const patterns = await registry.getPatterns('fr');
      
      expect(patterns).toBeDefined();
      expect(patterns.profanity.length).toBeGreaterThan(0);
    });

    it('should load German patterns', async () => {
      const patterns = await registry.getPatterns('de');
      
      expect(patterns).toBeDefined();
      expect(patterns.profanity.length).toBeGreaterThan(0);
    });

    it('should load Portuguese patterns', async () => {
      const patterns = await registry.getPatterns('pt');
      
      expect(patterns).toBeDefined();
      expect(patterns.profanity.length).toBeGreaterThan(0);
    });

    it('should load Italian patterns', async () => {
      const patterns = await registry.getPatterns('it');
      
      expect(patterns).toBeDefined();
      expect(patterns.profanity.length).toBeGreaterThan(0);
    });

    it('should cache loaded patterns', async () => {
      const patterns1 = await registry.getPatterns('en');
      const patterns2 = await registry.getPatterns('en');
      
      // Should return same reference (cached)
      expect(patterns1).toBe(patterns2);
    });
  });

  describe('getMultiLanguagePatterns', () => {
    it('should combine patterns from multiple languages', async () => {
      const patterns = await registry.getMultiLanguagePatterns(['en', 'es']);
      
      expect(patterns.profanity.length).toBeGreaterThan(0);
      expect(patterns.hateSpech.length).toBeGreaterThan(0);
      expect(patterns.spam.length).toBeGreaterThan(0);
    });

    it('should remove duplicate patterns', async () => {
      const patterns = await registry.getMultiLanguagePatterns(['en', 'es', 'fr']);
      
      // Spam patterns might have duplicates (e.g., discord.gg links)
      const profanitySet = new Set(patterns.profanity);
      expect(profanitySet.size).toBe(patterns.profanity.length); // No duplicates
    });

    it('should handle single language', async () => {
      const patterns = await registry.getMultiLanguagePatterns(['en']);
      
      expect(patterns.profanity.length).toBeGreaterThan(0);
    });

    it('should handle empty array', async () => {
      const patterns = await registry.getMultiLanguagePatterns([]);
      
      expect(patterns.profanity).toEqual([]);
      expect(patterns.hateSpech).toEqual([]);
      expect(patterns.spam).toEqual([]);
    });

    it('should include patterns from all requested languages', async () => {
      const enPatterns = await registry.getPatterns('en');
      const esPatterns = await registry.getPatterns('es');
      const combinedPatterns = await registry.getMultiLanguagePatterns(['en', 'es']);
      
      // Combined should have at least as many as the larger individual set
      expect(combinedPatterns.profanity.length).toBeGreaterThanOrEqual(
        Math.max(enPatterns.profanity.length, esPatterns.profanity.length)
      );
    });
  });

  describe('getCategoryPatterns', () => {
    it('should get profanity patterns for single language', async () => {
      const patterns = await registry.getCategoryPatterns('profanity', 'en');
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should get hate speech patterns for single language', async () => {
      const patterns = await registry.getCategoryPatterns('hateSpech', 'es');
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should get spam patterns for single language', async () => {
      const patterns = await registry.getCategoryPatterns('spam', 'fr');
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should get patterns for multiple languages', async () => {
      const patterns = await registry.getCategoryPatterns('profanity', ['en', 'es', 'fr']);
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should handle empty language array', async () => {
      const patterns = await registry.getCategoryPatterns('profanity', []);
      
      expect(patterns).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await registry.getPatterns('en');
      registry.clearCache();
      
      const patterns = await registry.getPatterns('en');
      expect(patterns).toBeDefined();
    });

    it('should not break after clearing cache', async () => {
      const patterns1 = await registry.getPatterns('en');
      registry.clearCache();
      const patterns2 = await registry.getPatterns('en');
      
      // Should have same content, different reference
      expect(patterns1.profanity.length).toBe(patterns2.profanity.length);
    });
  });

  describe('preloadPatterns', () => {
    it('should preload patterns without error', async () => {
      await expect(registry.preloadPatterns(['en', 'es', 'fr'])).resolves.not.toThrow();
    });

    it('should cache preloaded patterns', async () => {
      await registry.preloadPatterns(['en']);
      
      // Should be cached now
      const patterns = await registry.getPatterns('en');
      expect(patterns).toBeDefined();
    });
  });

  describe('pattern structure', () => {
    it('should return valid regex pattern strings', async () => {
      const patterns = await registry.getPatterns('en');
      
      // Check that patterns can be compiled as RegExp
      for (const pattern of patterns.profanity.slice(0, 5)) { // Test first 5
        expect(() => new RegExp(pattern, 'gi')).not.toThrow();
      }
    });

    it('should have consistent pattern format across languages', async () => {
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'it'];
      
      for (const lang of languages) {
        const patterns = await registry.getPatterns(lang as any);
        
        expect(patterns).toHaveProperty('profanity');
        expect(patterns).toHaveProperty('hateSpech');
        expect(patterns).toHaveProperty('spam');
        
        expect(Array.isArray(patterns.profanity)).toBe(true);
        expect(Array.isArray(patterns.hateSpech)).toBe(true);
        expect(Array.isArray(patterns.spam)).toBe(true);
      }
    });
  });
});
