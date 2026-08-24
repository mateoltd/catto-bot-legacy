import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  matchAcceptLanguage,
  matchSupportedLocale,
  type AppLocale,
  type DashboardMessages,
} from '@/i18n/config';

const messageLoaders: Record<
  AppLocale,
  () => Promise<{ default: DashboardMessages }>
> = {
  'en-US': () => import('@/messages/en-US.json'),
  'es-ES': () => import('@/messages/es-ES.json'),
  'fr-FR': () => import('@/messages/fr-FR.json'),
};

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale =
    matchSupportedLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value) ??
    matchAcceptLanguage(headerStore.get('accept-language')) ??
    DEFAULT_LOCALE;

  return {
    locale,
    messages: (await messageLoaders[locale]()).default,
    // Keep server and client markup deterministic until a user time-zone preference is added.
    timeZone: 'UTC',
  };
});
