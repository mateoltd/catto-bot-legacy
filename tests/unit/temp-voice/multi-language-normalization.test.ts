/**
 * Unit tests for Multi-Language Name Normalization
 */

import { describe, it, expect } from 'vitest';
import { NameNormalizationService } from '../../../src/modules/temp-voice/services/moderation/name-normalization.service.js';

describe('NameNormalizationService - Multi-Language', () => {
  const service = new NameNormalizationService();

  describe('Spanish character normalization', () => {
    it('should normalize Spanish á', () => {
      const result = service.decodeLeetspeak('conversación');
      expect(result).toContain('a');
    });

    it('should normalize Spanish é', () => {
      const result = service.decodeLeetspeak('café');
      expect(result).toContain('e');
    });

    it('should normalize Spanish í', () => {
      const result = service.decodeLeetspeak('difícil');
      expect(result).toContain('i');
    });

    it('should normalize Spanish ó', () => {
      const result = service.decodeLeetspeak('canción');
      expect(result).toContain('o');
    });

    it('should normalize Spanish ú', () => {
      const result = service.decodeLeetspeak('menú');
      expect(result).toContain('u');
    });

    it('should normalize Spanish ñ', () => {
      const result = service.decodeLeetspeak('español');
      expect(result).toBe('espanol');
    });

    it('should normalize Spanish ü', () => {
      const result = service.decodeLeetspeak('pingüino');
      expect(result).toContain('u');
    });

    it('should handle mixed Spanish text', () => {
      const result = service.decodeLeetspeak('conversación español');
      expect(result).toBe('conversacion espanol');
    });
  });

  describe('French character normalization', () => {
    it('should normalize French à', () => {
      const result = service.decodeLeetspeak('à');
      expect(result).toBe('a');
    });

    it('should normalize French â', () => {
      const result = service.decodeLeetspeak('pâte');
      expect(result).toBe('pate');
    });

    it('should normalize French è', () => {
      const result = service.decodeLeetspeak('très');
      expect(result).toBe('tres');
    });

    it('should normalize French ê', () => {
      const result = service.decodeLeetspeak('ête');
      expect(result).toBe('ete');
    });

    it('should normalize French é', () => {
      const result = service.decodeLeetspeak('café');
      expect(result).toBe('cafe');
    });

    it('should normalize French ç', () => {
      const result = service.decodeLeetspeak('français');
      expect(result).toBe('francais');
    });

    it('should normalize French î', () => {
      const result = service.decodeLeetspeak('île');
      expect(result).toBe('ile');
    });

    it('should normalize French ô', () => {
      const result = service.decodeLeetspeak('hôtel');
      expect(result).toBe('hotel');
    });

    it('should normalize French ù', () => {
      const result = service.decodeLeetspeak('où');
      expect(result).toBe('ou');
    });

    it('should handle mixed French text', () => {
      const result = service.decodeLeetspeak('français café');
      expect(result).toBe('francais cafe');
    });
  });

  describe('German character normalization', () => {
    it('should normalize German ä to ae', () => {
      const result = service.decodeLeetspeak('käse');
      expect(result).toBe('kaese');
    });

    it('should normalize German ö to oe', () => {
      const result = service.decodeLeetspeak('schön');
      expect(result).toBe('schoen');
    });

    it('should normalize German ü to ue', () => {
      const result = service.decodeLeetspeak('über');
      expect(result).toBe('ueber');
    });

    it('should normalize German ß to ss', () => {
      const result = service.decodeLeetspeak('straße');
      expect(result).toBe('strasse');
    });

    it('should handle mixed German text', () => {
      const result = service.decodeLeetspeak('gemütlich über');
      expect(result).toBe('gemuetlich ueber');
    });

    it('should handle capitalized German umlauts', () => {
      const result = service.decodeLeetspeak('Über');
      expect(result).toBe('ueber');
    });
  });

  describe('Portuguese character normalization', () => {
    it('should normalize Portuguese á', () => {
      const result = service.decodeLeetspeak('água');
      expect(result).toContain('a');
    });

    it('should normalize Portuguese â', () => {
      const result = service.decodeLeetspeak('pânico');
      expect(result).toBe('panico');
    });

    it('should normalize Portuguese ã', () => {
      const result = service.decodeLeetspeak('irmã');
      expect(result).toBe('irma');
    });

    it('should normalize Portuguese é', () => {
      const result = service.decodeLeetspeak('café');
      expect(result).toBe('cafe');
    });

    it('should normalize Portuguese ê', () => {
      const result = service.decodeLeetspeak('você');
      expect(result).toBe('voce');
    });

    it('should normalize Portuguese ó', () => {
      const result = service.decodeLeetspeak('avó');
      expect(result).toContain('o');
    });

    it('should normalize Portuguese ô', () => {
      const result = service.decodeLeetspeak('avô');
      expect(result).toContain('o');
    });

    it('should normalize Portuguese õ', () => {
      const result = service.decodeLeetspeak('não');
      expect(result).toBe('nao');
    });

    it('should handle mixed Portuguese text', () => {
      const result = service.decodeLeetspeak('conversa ção');
      expect(result).toBe('conversa cao');
    });
  });

  describe('Italian character normalization', () => {
    it('should normalize Italian à', () => {
      const result = service.decodeLeetspeak('città');
      expect(result).toBe('citta');
    });

    it('should normalize Italian è', () => {
      const result = service.decodeLeetspeak('caffè');
      expect(result).toBe('caffe');
    });

    it('should normalize Italian é', () => {
      const result = service.decodeLeetspeak('perché');
      expect(result).toBe('perche');
    });

    it('should normalize Italian ì', () => {
      const result = service.decodeLeetspeak('così');
      expect(result).toBe('cosi');
    });

    it('should normalize Italian ò', () => {
      const result = service.decodeLeetspeak('però');
      expect(result).toBe('pero');
    });

    it('should normalize Italian ù', () => {
      const result = service.decodeLeetspeak('più');
      expect(result).toBe('piu');
    });

    it('should handle mixed Italian text', () => {
      const result = service.decodeLeetspeak('città però');
      expect(result).toBe('citta pero');
    });
  });

  describe('Mixed-language normalization', () => {
    it('should handle text with multiple language accents', () => {
      const result = service.decodeLeetspeak('café español français');
      expect(result).toBe('cafe espanol francais');
    });

    it('should handle German and French together', () => {
      const result = service.decodeLeetspeak('über café');
      expect(result).toBe('ueber cafe');
    });

    it('should handle Spanish and Portuguese together', () => {
      const result = service.decodeLeetspeak('español não');
      expect(result).toBe('espanol nao');
    });
  });

  describe('Combined leetspeak and accents', () => {
    it('should handle accents with leetspeak', () => {
      const result = service.decodeLeetspeak('c@fé');
      expect(result).toBe('cafe');
    });

    it('should handle Spanish with leetspeak', () => {
      const result = service.decodeLeetspeak('c0nv3rsación');
      expect(result).toBe('conversacion');
    });

    it('should handle German with leetspeak', () => {
      const result = service.decodeLeetspeak('üb3r');
      expect(result).toBe('ueber');
    });

    it('should handle French with leetspeak', () => {
      const result = service.decodeLeetspeak('françai5');
      expect(result).toBe('francais');
    });
  });

  describe('Full normalization with accents', () => {
    it('should normalize Spanish name fully', () => {
      const result = service.normalize('  Conversación Español  ');
      expect(result.normalized).toBe('conversación español');
      // decodedLeetspeak is derived from withoutSeparators (spaces removed)
      expect(result.decodedLeetspeak).toBe('conversacionespanol');
      // decodedLeetspeakWithSpaces preserves word boundaries
      expect(result.decodedLeetspeakWithSpaces).toBe('conversacion espanol');
    });

    it('should normalize French name fully', () => {
      const result = service.normalize('Café Français');
      expect(result.normalized).toBe('café français');
      expect(result.decodedLeetspeak).toBe('cafefrancais');
      expect(result.decodedLeetspeakWithSpaces).toBe('cafe francais');
    });

    it('should normalize German name fully', () => {
      const result = service.normalize('Über Gemütlich');
      expect(result.normalized).toBe('über gemütlich');
      expect(result.decodedLeetspeak).toBe('uebergemuetlich');
      expect(result.decodedLeetspeakWithSpaces).toBe('ueber gemuetlich');
    });
  });

  describe('Uppercase accent handling', () => {
    it('should normalize uppercase Spanish accents', () => {
      const result = service.decodeLeetspeak('CONVERSACIÓN');
      expect(result).toBe('conversacion');
    });

    it('should normalize uppercase French accents', () => {
      const result = service.decodeLeetspeak('FRANÇAIS');
      expect(result).toBe('francais');
    });

    it('should normalize uppercase German umlauts', () => {
      const result = service.decodeLeetspeak('ÜBER');
      expect(result).toBe('ueber');
    });

    it('should normalize mixed case with accents', () => {
      const result = service.decodeLeetspeak('CaFé EsPañOL');
      expect(result).toBe('cafe espanol');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = service.decodeLeetspeak('');
      expect(result).toBe('');
    });

    it('should handle string with only accents', () => {
      const result = service.decodeLeetspeak('áéíóú');
      expect(result).toBe('aeiou');
    });

    it('should handle repeated accented characters', () => {
      const result = service.decodeLeetspeak('ããããã');
      expect(result).toBe('aaaaa');
    });

    it('should handle accents with separators', () => {
      const result = service.normalize('c-a-f-é');
      expect(result.withoutSeparators).toBe('café');
      expect(result.decodedLeetspeak).toBe('cafe');
    });

    it('should preserve non-accented characters', () => {
      const result = service.decodeLeetspeak('abc xyz');
      expect(result).toBe('abc xyz');
    });

    it('should handle numbers with accents', () => {
      // Leetspeak map: 1→i, 3→e, so numbers get decoded
      const result = service.decodeLeetspeak('café 123');
      expect(result).toBe('cafe i2e');
    });
  });

  describe('Unicode normalization compatibility', () => {
    it('should work with unicode normalization', () => {
      const result = service.normalize('café');
      expect(result.unicodeNormalized).toBe('cafe');
    });

    it('should handle decomposed unicode', () => {
      // NFD decomposition of é
      const decomposed = 'cafe\u0301'; // e + combining acute accent
      const result = service.normalizeUnicode(decomposed);
      expect(result.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Language-specific obfuscation detection', () => {
    it('should detect obfuscated Spanish words', () => {
      const result = service.normalize('c-o-n-v-e-r-s-a-c-i-ó-n');
      expect(result.withoutSeparators).toBe('conversación');
      expect(result.decodedLeetspeak).toBe('conversacion');
    });

    it('should detect obfuscated French words', () => {
      const result = service.normalize('f_r_a_n_ç_a_i_s');
      expect(result.withoutSeparators).toBe('français');
      expect(result.decodedLeetspeak).toBe('francais');
    });

    it('should detect obfuscated German words', () => {
      const result = service.normalize('ü.b.e.r');
      expect(result.withoutSeparators).toBe('über');
      expect(result.decodedLeetspeak).toBe('ueber');
    });

    it('should combine all normalization techniques', () => {
      const result = service.normalize('  C-0-N-V-E-R-S-@-C-I-Ó-N  ');
      expect(result.normalized).toBe('c-0-n-v-e-r-s-@-c-i-ó-n');
      // @ is a leetspeak char (not a separator), so it stays in withoutSeparators
      expect(result.withoutSeparators).toBe('c0nvers@ción');
      // decodeLeetspeak converts @→a, 0→o, ó→o
      expect(result.decodedLeetspeak).toBe('conversacion');
    });
  });
});
