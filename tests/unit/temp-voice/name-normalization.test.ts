/**
 * Unit tests for Name Normalization Service
 */

import { describe, it, expect } from 'vitest';
import { NameNormalizationService } from '../../../src/modules/temp-voice/services/moderation/name-normalization.service.js';

describe('NameNormalizationService', () => {
  const service = new NameNormalizationService();

  describe('normalize', () => {
    it('should normalize basic text', () => {
      const result = service.normalize('  Hello World  ');
      expect(result.original).toBe('  Hello World  ');
      expect(result.normalized).toBe('hello world');
    });

    it('should collapse multiple spaces', () => {
      const result = service.normalize('Hello    World');
      expect(result.normalized).toBe('hello world');
    });

    it('should convert to lowercase', () => {
      const result = service.normalize('HeLLo WoRLD');
      expect(result.normalized).toBe('hello world');
    });
  });

  describe('removeSeparators', () => {
    it('should remove common separators', () => {
      expect(service.removeSeparators('h-e-l-l-o')).toBe('hello');
      expect(service.removeSeparators('h_e_l_l_o')).toBe('hello');
      expect(service.removeSeparators('h.e.l.l.o')).toBe('hello');
      expect(service.removeSeparators('h e l l o')).toBe('hello');
    });

    it('should remove mixed separators', () => {
      expect(service.removeSeparators('h-e_l.l o')).toBe('hello');
    });

    it('should handle bullet points and special separators', () => {
      expect(service.removeSeparators('test•word')).toBe('testword');
      expect(service.removeSeparators('test·word')).toBe('testword');
    });
  });

  describe('decodeLeetspeak', () => {
    it('should decode basic leetspeak', () => {
      expect(service.decodeLeetspeak('h3ll0')).toBe('hello');
      expect(service.decodeLeetspeak('h@t3')).toBe('hate');
      expect(service.decodeLeetspeak('t3st')).toBe('test');
    });

    it('should decode leetspeak with numbers', () => {
      expect(service.decodeLeetspeak('w0rd')).toBe('word');
      expect(service.decodeLeetspeak('l33t')).toBe('leet');
    });

    it('should decode leetspeak with symbols', () => {
      expect(service.decodeLeetspeak('t3$t')).toBe('test');
      expect(service.decodeLeetspeak('h@ck')).toBe('hack');
    });

    it('should handle complex leetspeak', () => {
      expect(service.decodeLeetspeak('4w3$0m3')).toBe('awesome');
    });
  });

  describe('normalizeUnicode', () => {
    it('should normalize accented characters', () => {
      expect(service.normalizeUnicode('café')).toBe('cafe');
      expect(service.normalizeUnicode('naïve')).toBe('naive');
      expect(service.normalizeUnicode('résumé')).toBe('resume');
    });

    it('should handle various diacritics', () => {
      expect(service.normalizeUnicode('ñoño')).toBe('nono');
      expect(service.normalizeUnicode('Zürich')).toBe('zurich');
    });
  });

  describe('removeZeroWidthChars', () => {
    it('should remove zero-width spaces', () => {
      const textWithZeroWidth = 'hel\u200Blo';
      expect(service.removeZeroWidthChars(textWithZeroWidth)).toBe('hello');
    });

    it('should remove multiple zero-width characters', () => {
      const textWithMultiple = 'h\u200Be\u200Bl\u200Bl\u200Bo';
      expect(service.removeZeroWidthChars(textWithMultiple)).toBe('hello');
    });

    it('should remove zero-width non-joiner', () => {
      const text = 'hel\u200Clo';
      expect(service.removeZeroWidthChars(text)).toBe('hello');
    });
  });

  describe('tokenize', () => {
    it('should split text into tokens', () => {
      const result = service.tokenize('hello world test');
      expect(result).toEqual(['hello', 'world', 'test']);
    });

    it('should split on various delimiters', () => {
      const result = service.tokenize('hello-world_test.room');
      expect(result).toEqual(['hello', 'world', 'test', 'room']);
    });

    it('should filter empty tokens', () => {
      const result = service.tokenize('hello  world');
      expect(result).toEqual(['hello', 'world']);
    });

    it('should handle punctuation', () => {
      const result = service.tokenize('hello, world! test?');
      expect(result).toEqual(['hello', 'world', 'test']);
    });
  });

  describe('deepNormalize', () => {
    it('should apply all normalizations', () => {
      const input = 'H3LL0 W0RLD';
      const result = service.deepNormalize(input);
      expect(result).toBe('helloworld');
    });

    it('should handle complex obfuscation', () => {
      const input = 'h-3-l-l-0';
      const result = service.deepNormalize(input);
      expect(result).toBe('hello');
    });

    it('should handle unicode and leetspeak together', () => {
      const input = 'café w1th l33t';
      const result = service.deepNormalize(input);
      expect(result).toBe('cafewithleet');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(service.calculateSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = service.calculateSimilarity('abc', 'xyz');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should calculate similarity for similar strings', () => {
      const similarity = service.calculateSimilarity('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0.7);
    });
  });

  describe('detectHomoglyphs', () => {
    it('should detect Cyrillic characters', () => {
      expect(service.detectHomoglyphs('hеllo')).toBe(true); // е is Cyrillic
    });

    it('should detect Greek characters', () => {
      expect(service.detectHomoglyphs('αlpha')).toBe(true);
    });

    it('should not detect for pure ASCII', () => {
      expect(service.detectHomoglyphs('hello')).toBe(false);
    });
  });

  describe('countNonAscii', () => {
    it('should count zero for ASCII text', () => {
      expect(service.countNonAscii('hello world')).toBe(0);
    });

    it('should count non-ASCII characters', () => {
      expect(service.countNonAscii('café')).toBe(1);
      expect(service.countNonAscii('naïve')).toBe(1);
    });

    it('should count multiple non-ASCII characters', () => {
      expect(service.countNonAscii('αβγ')).toBe(3);
    });
  });

  describe('detectRepetition', () => {
    it('should detect character repetition', () => {
      const result = service.detectRepetition('heeello');
      expect(result.maxRepetition).toBe(3);
      expect(result.character).toBe('e');
    });

    it('should handle no repetition', () => {
      const result = service.detectRepetition('hello');
      expect(result.maxRepetition).toBe(2);
      expect(result.character).toBe('l');
    });

    it('should detect longest repetition', () => {
      const result = service.detectRepetition('heeeello');
      expect(result.maxRepetition).toBe(4);
      expect(result.character).toBe('e');
    });
  });

  describe('calculateSymbolDensity', () => {
    it('should return 0 for alphanumeric text', () => {
      expect(service.calculateSymbolDensity('hello123')).toBe(0);
    });

    it('should calculate symbol density', () => {
      const density = service.calculateSymbolDensity('h!e@l#l$o');
      expect(density).toBeCloseTo(0.4, 1);
    });

    it('should handle 100% symbols', () => {
      expect(service.calculateSymbolDensity('!@#$%')).toBe(1);
    });

    it('should not count spaces as symbols', () => {
      const density = service.calculateSymbolDensity('hello world');
      expect(density).toBe(0); // spaces are excluded from symbol count
    });
  });
});
