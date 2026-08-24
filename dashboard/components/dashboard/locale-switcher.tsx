'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLanguage } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { isAppLocale, SUPPORTED_LOCALES } from '@/i18n/config';

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('Locale');
  const router = useRouter();
  const selectId = useId();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLocale = async (value: string) => {
    if (!isAppLocale(value) || value === locale) return;

    setIsUpdating(true);
    setError(null);
    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: value }),
      });
      if (!response.ok) throw new Error('Locale update failed');
      router.refresh();
    } catch {
      setError(t('updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="border-b border-border px-3 py-2">
      <label
        htmlFor={selectId}
        className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <IconLanguage size={15} aria-hidden="true" />
        {t('label')}
      </label>
      <select
        id={selectId}
        value={locale}
        disabled={isUpdating}
        onChange={(event) => void updateLocale(event.target.value)}
        aria-label={t('change')}
        className="h-9 w-full border border-border bg-background px-2 text-xs text-foreground disabled:opacity-60"
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {t(supportedLocale)}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
