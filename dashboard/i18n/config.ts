export const SUPPORTED_LOCALES = ['en-US', 'es-ES'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type DashboardMessages = typeof import('@/messages/en-US.json');

export const DEFAULT_LOCALE: AppLocale = 'en-US';
export const LOCALE_COOKIE_NAME = 'CATTO_DASH_LOCALE';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const localeByLanguage: Record<string, AppLocale> = {
  en: 'en-US',
  es: 'es-ES',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function matchSupportedLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;

  const normalized = value.trim().replaceAll('_', '-');
  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
  );
  if (exact) return exact;

  const language = normalized.split('-')[0]?.toLocaleLowerCase();
  return language ? (localeByLanguage[language] ?? null) : null;
}

export function matchAcceptLanguage(value: string | null | undefined): AppLocale | null {
  if (!value) return null;

  const preferences = value
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;

      return {
        tag,
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter(({ tag, quality }) => Boolean(tag) && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const preference of preferences) {
    const locale = matchSupportedLocale(preference.tag);
    if (locale) return locale;
  }

  return null;
}
