import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import {
  DEFAULT_LOCALE,
  isAppLocale,
  matchAcceptLanguage,
  matchSupportedLocale,
} from '@/i18n/config';
import englishMessages from '@/messages/en-US.json';
import spanishMessages from '@/messages/es-ES.json';

function messageKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object'
      ? messageKeys(child as Record<string, unknown>, path)
      : [path];
  });
}

describe('dashboard locale configuration', () => {
  it('matches exact, regional, and underscore locale variants', () => {
    expect(matchSupportedLocale('es_419')).toBe('es-ES');
    expect(matchSupportedLocale('en-GB')).toBe('en-US');
  });

  it('rejects unsupported locale values', () => {
    expect(matchSupportedLocale('fr-FR')).toBeNull();
    expect(matchSupportedLocale(null)).toBeNull();
    expect(isAppLocale('es-ES')).toBe(true);
    expect(isAppLocale('fr-FR')).toBe(false);
  });

  it('honors Accept-Language quality values and ignores disabled entries', () => {
    expect(matchAcceptLanguage('de-DE, en-GB;q=0.8, es-ES;q=0.9')).toBe('es-ES');
    expect(matchAcceptLanguage('es-ES;q=0, en-GB;q=0.7')).toBe('en-US');
    expect(matchAcceptLanguage('de-DE')).toBeNull();
    expect(matchAcceptLanguage(null) ?? DEFAULT_LOCALE).toBe('en-US');
  });

  it('keeps every locale catalog structurally complete', () => {
    expect(messageKeys(spanishMessages).sort()).toEqual(messageKeys(englishMessages).sort());
  });

  it('preserves bot template variables as literal placeholders', () => {
    const english = createTranslator({ locale: 'en-US', messages: englishMessages });
    const spanish = createTranslator({ locale: 'es-ES', messages: spanishMessages });

    expect(english('Rewards.announcementPlaceholder')).toContain('{user}');
    expect(english('Rewards.announcementPlaceholderEdit')).toContain('{level}');
    expect(spanish('TempVoice.customPatternPlaceholder')).toContain('{username}');
  });

  it('translates the evidence review and upload workflows into Spanish', () => {
    const spanish = createTranslator({ locale: 'es-ES', messages: spanishMessages });

    expect(spanish('Moderation.compareEvidence')).toBe('Comparar pruebas');
    expect(spanish('Moderation.filesQueued', { count: 2 })).toBe(
      '2 archivos en cola. Añade más si lo necesitas.'
    );
    expect(spanish('Moderation.chainOfCustody', { count: 1 })).toContain('1 registro');
    expect(spanish('ColorField.saturationAndBrightness')).toBe('Saturación y brillo');
  });
});
