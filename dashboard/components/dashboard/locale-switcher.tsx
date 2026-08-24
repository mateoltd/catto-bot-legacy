'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLanguage } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { isAppLocale, SUPPORTED_LOCALES } from '@/i18n/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('Locale');
  const router = useRouter();
  const selectId = useId();
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLocale = async (value: string) => {
    if (!isAppLocale(value) || value === locale) return;

    setSelectedLocale(value);
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
      setSelectedLocale(locale);
      setError(t('updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={selectId} className="sr-only">
        {t('label')}
      </label>
      <Select
        value={selectedLocale}
        disabled={isUpdating}
        onValueChange={(value) => void updateLocale(value)}
      >
        <SelectTrigger
          id={selectId}
          aria-label={t('change')}
          size="sm"
          className="w-10 px-2 text-xs sm:w-36"
        >
          <IconLanguage size={15} aria-hidden="true" />
          <SelectValue className="hidden sm:flex" />
        </SelectTrigger>
        <SelectContent align="end" position="popper">
          {SUPPORTED_LOCALES.map((supportedLocale) => (
            <SelectItem key={supportedLocale} value={supportedLocale}>
              {t(supportedLocale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p
          className="absolute right-0 top-full z-50 mt-1 w-64 border border-destructive/40 bg-popover p-2 text-xs text-red-400 shadow-xl"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
