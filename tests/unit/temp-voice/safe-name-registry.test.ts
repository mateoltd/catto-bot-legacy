/**
 * Unit tests for Safe Name Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafeNameRegistry } from '../../../src/modules/temp-voice/constants/safe-names/safe-names-registry.js';

describe('SafeNameRegistry', () => {
  let registry: SafeNameRegistry;

  beforeEach(() => {
    registry = new SafeNameRegistry();
    registry.clearCache(); // Ensure clean state
  });

  describe('getSafeNames', () => {
    it('should load English safe names', async () => {
      const names = await registry.getSafeNames('en');
      
      expect(names).toBeDefined();
      expect(names.adjectives).toBeDefined();
      expect(names.nouns).toBeDefined();
      expect(names.templates).toBeDefined();
      
      expect(names.adjectives.length).toBeGreaterThan(0);
      expect(names.nouns.length).toBeGreaterThan(0);
      expect(names.templates.length).toBeGreaterThan(0);
    });

    it('should load Spanish safe names', async () => {
      const names = await registry.getSafeNames('es');
      
      expect(names.adjectives.length).toBeGreaterThan(0);
      expect(names.nouns.length).toBeGreaterThan(0);
      expect(names.templates.length).toBeGreaterThan(0);
    });

    it('should load French safe names', async () => {
      const names = await registry.getSafeNames('fr');
      
      expect(names.adjectives.length).toBeGreaterThan(0);
      expect(names.nouns.length).toBeGreaterThan(0);
      expect(names.templates.length).toBeGreaterThan(0);
    });

    it('should load German safe names', async () => {
      const names = await registry.getSafeNames('de');
      
      expect(names.adjectives.length).toBeGreaterThan(0);
      expect(names.nouns.length).toBeGreaterThan(0);
      expect(names.templates.length).toBeGreaterThan(0);
    });

    it('should load Portuguese safe names', async () => {
      const names = await registry.getSafeNames('pt');
      
      expect(names.adjectives.length).toBeGreaterThan(0);
      expect(names.nouns.length).toBeGreaterThan(0);
      expect(names.templates.length).toBeGreaterThan(0);
    });

    it('should load Italian safe names', async () => {
      const names = await registry.getSafeNames('it');
      
      expect(names.adjectives.length).toBeGreaterThan(0);
      expect(names.nouns.length).toBeGreaterThan(0);
      expect(names.templates.length).toBeGreaterThan(0);
    });

    it('should cache loaded safe names', async () => {
      const names1 = await registry.getSafeNames('en');
      const names2 = await registry.getSafeNames('en');
      
      // Should return same reference (cached)
      expect(names1).toBe(names2);
    });
  });

  describe('getRandomSafeName', () => {
    it('should generate random template name in English', async () => {
      const name = await registry.getRandomSafeName('en', true);
      
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should generate random adjective+noun name in English', async () => {
      const name = await registry.getRandomSafeName('en', false);
      
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      expect(name).toContain(' '); // Should have space between adjective and noun
    });

    it('should generate different names on multiple calls', async () => {
      const names = new Set<string>();
      
      for (let i = 0; i < 20; i++) {
        const name = await registry.getRandomSafeName('en', true);
        names.add(name);
      }
      
      // Should have some variety (at least 5 different names out of 20)
      expect(names.size).toBeGreaterThan(5);
    });

    it('should generate valid Spanish names', async () => {
      const name = await registry.getRandomSafeName('es', true);
      
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should generate valid French names', async () => {
      const name = await registry.getRandomSafeName('fr', true);
      
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should generate valid German names', async () => {
      const name = await registry.getRandomSafeName('de', false);
      
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should not return undefined or null', async () => {
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'it'] as const;
      
      for (const lang of languages) {
        const name = await registry.getRandomSafeName(lang);
        expect(name).toBeDefined();
        expect(name).not.toBeNull();
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateSafeNameOptions', () => {
    it('should generate multiple name options', async () => {
      const options = await registry.generateSafeNameOptions('en', 5);
      
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
      expect(options.length).toBeLessThanOrEqual(5);
    });

    it('should generate unique name options', async () => {
      const options = await registry.generateSafeNameOptions('en', 10);
      const uniqueOptions = new Set(options);
      
      expect(uniqueOptions.size).toBe(options.length); // All should be unique
    });

    it('should generate requested number of options', async () => {
      const count = 3;
      const options = await registry.generateSafeNameOptions('es', count);
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.length).toBeLessThanOrEqual(count);
    });

    it('should handle large requested counts', async () => {
      const options = await registry.generateSafeNameOptions('en', 100);
      
      expect(options.length).toBeGreaterThan(0);
      // Might not reach 100 due to uniqueness constraints, but should try
    });

    it('should default to 5 options when count not specified', async () => {
      const options = await registry.generateSafeNameOptions('en');
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getAdjectives', () => {
    it('should return adjectives for English', async () => {
      const adjectives = await registry.getAdjectives('en');
      
      expect(Array.isArray(adjectives)).toBe(true);
      expect(adjectives.length).toBeGreaterThan(0);
    });

    it('should return adjectives for Spanish', async () => {
      const adjectives = await registry.getAdjectives('es');
      
      expect(adjectives.length).toBeGreaterThan(0);
    });

    it('should return different adjectives for different languages', async () => {
      const enAdjectives = await registry.getAdjectives('en');
      const esAdjectives = await registry.getAdjectives('es');
      
      // Different languages should have different words
      const esSet = new Set(esAdjectives);
      const intersection = enAdjectives.filter((adj) => esSet.has(adj));
      
      // Most adjectives should be different
      expect(intersection.length).toBeLessThan(enAdjectives.length / 2);
    });
  });

  describe('getNouns', () => {
    it('should return nouns for English', async () => {
      const nouns = await registry.getNouns('en');
      
      expect(Array.isArray(nouns)).toBe(true);
      expect(nouns.length).toBeGreaterThan(0);
    });

    it('should return nouns for French', async () => {
      const nouns = await registry.getNouns('fr');
      
      expect(nouns.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplates', () => {
    it('should return templates for English', async () => {
      const templates = await registry.getTemplates('en');
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should return templates for German', async () => {
      const templates = await registry.getTemplates('de');
      
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await registry.getSafeNames('en');
      registry.clearCache();
      
      const names = await registry.getSafeNames('en');
      expect(names).toBeDefined();
    });

    it('should not break after clearing cache', async () => {
      const names1 = await registry.getSafeNames('en');
      registry.clearCache();
      const names2 = await registry.getSafeNames('en');
      
      // Should have same content, different reference
      expect(names1.adjectives.length).toBe(names2.adjectives.length);
    });
  });

  describe('preloadSafeNames', () => {
    it('should preload safe names without error', async () => {
      await expect(registry.preloadSafeNames(['en', 'es', 'fr'])).resolves.not.toThrow();
    });

    it('should cache preloaded names', async () => {
      await registry.preloadSafeNames(['en']);
      
      // Should be cached now
      const names = await registry.getSafeNames('en');
      expect(names).toBeDefined();
    });

    it('should preload all requested languages', async () => {
      await registry.preloadSafeNames(['en', 'es', 'fr', 'de']);
      
      // All should be available
      const enNames = await registry.getSafeNames('en');
      const esNames = await registry.getSafeNames('es');
      const frNames = await registry.getSafeNames('fr');
      const deNames = await registry.getSafeNames('de');
      
      expect(enNames.adjectives.length).toBeGreaterThan(0);
      expect(esNames.adjectives.length).toBeGreaterThan(0);
      expect(frNames.adjectives.length).toBeGreaterThan(0);
      expect(deNames.adjectives.length).toBeGreaterThan(0);
    });
  });

  describe('name structure', () => {
    it('should have consistent structure across languages', async () => {
      const languages = ['en', 'es', 'fr', 'de', 'pt', 'it'];
      
      for (const lang of languages) {
        const names = await registry.getSafeNames(lang as any);
        
        expect(names).toHaveProperty('adjectives');
        expect(names).toHaveProperty('nouns');
        expect(names).toHaveProperty('templates');
        
        expect(Array.isArray(names.adjectives)).toBe(true);
        expect(Array.isArray(names.nouns)).toBe(true);
        expect(Array.isArray(names.templates)).toBe(true);
      }
    });

    it('should have non-empty strings in adjectives', async () => {
      const names = await registry.getSafeNames('en');
      
      for (const adj of names.adjectives) {
        expect(typeof adj).toBe('string');
        expect(adj.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty strings in nouns', async () => {
      const names = await registry.getSafeNames('en');
      
      for (const noun of names.nouns) {
        expect(typeof noun).toBe('string');
        expect(noun.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty strings in templates', async () => {
      const names = await registry.getSafeNames('en');
      
      for (const template of names.templates) {
        expect(typeof template).toBe('string');
        expect(template.length).toBeGreaterThan(0);
      }
    });
  });
});
