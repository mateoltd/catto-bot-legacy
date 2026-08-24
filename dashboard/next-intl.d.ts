import type { AppLocale, DashboardMessages } from '@/i18n/config';

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: DashboardMessages;
  }
}
