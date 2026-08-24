import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  isAppLocale,
  matchAcceptLanguage,
  matchSupportedLocale,
} from '@/i18n/config';

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
});
