'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { IconSearch, IconX } from '@/lib/mod-icons';
import { useTranslations } from 'next-intl';

interface EvidenceSearchProps {
  /** Controlled value (optional) */
  value?: string;
  /** Change handler for controlled mode */
  onChange?: (query: string) => void;
  /** Callback for search (debounced, alternative to onChange) */
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function EvidenceSearch({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder,
  className = '',
}: EvidenceSearchProps) {
  const t = useTranslations('Moderation');
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState('');
  const value = isControlled ? controlledValue : internalValue;

  // Sync internal value with controlled value
  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [isControlled, controlledValue]);

  const debouncedSearch = useDebouncedCallback((searchValue: string) => {
    onSearch?.(searchValue);
  }, 300);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
      debouncedSearch(newValue);
    },
    [isControlled, onChange, debouncedSearch]
  );

  const handleClear = useCallback(() => {
    debouncedSearch.cancel();
    if (!isControlled) {
      setInternalValue('');
    }
    onChange?.('');
    onSearch?.('');
  }, [isControlled, onChange, onSearch, debouncedSearch]);

  return (
    <div className={`relative ${className}`}>
      <IconSearch
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mod-text-dim)]"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? t('searchEvidenceShortPlaceholder')}
        className="w-full border border-[var(--mod-border)] bg-[var(--mod-surface)] py-2 pl-9 pr-9 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t('clearSearch')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
