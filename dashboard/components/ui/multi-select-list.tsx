'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MultiSelectItem {
  value: string;
  label: string;
  description?: string;
  prefix?: string;
  swatch?: string;
}

interface MultiSelectListProps {
  items: readonly MultiSelectItem[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  emptyLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function MultiSelectList({
  items,
  value,
  onValueChange,
  emptyLabel,
  searchPlaceholder,
  className,
}: MultiSelectListProps) {
  const t = useTranslations('ConfigCommon');
  const resolvedEmptyLabel = emptyLabel ?? t('noOptions');
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('filterOptions');
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.label.toLocaleLowerCase().includes(normalized));
  }, [items, query]);

  const toggle = (itemValue: string, checked: boolean) => {
    onValueChange(
      checked ? [...value, itemValue] : value.filter((current) => current !== itemValue)
    );
  };

  return (
    <div className={cn('border border-border bg-input', className)}>
      {items.length > 6 && (
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={resolvedSearchPlaceholder}
            aria-label={resolvedSearchPlaceholder}
            className="border-0 bg-transparent pl-10 focus-visible:ring-inset"
          />
        </div>
      )}
      <div className="max-h-56 overflow-y-auto p-1">
        {visibleItems.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">
            {items.length === 0 ? resolvedEmptyLabel : t('noMatchingOptions')}
          </p>
        ) : (
          visibleItems.map((item) => {
            const checked = selected.has(item.value);
            return (
              <label
                key={item.value}
                className={cn(
                  'flex min-h-9 cursor-pointer items-center gap-3 border-l-2 px-3 py-2 transition-colors',
                  checked
                    ? 'border-l-foreground bg-accent text-foreground'
                    : 'border-l-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Checkbox checked={checked} onCheckedChange={(state) => toggle(item.value, state === true)} />
                {item.swatch && (
                  <span className="h-3 w-3 shrink-0 border border-white/20" style={{ backgroundColor: item.swatch }} />
                )}
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate">
                    {item.prefix && <span className="mr-1 text-muted-foreground">{item.prefix}</span>}
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{t('selectedCount', { count: value.length })}</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onValueChange([])} className="hover:text-foreground">
            {t('clear')}
          </button>
        )}
      </div>
    </div>
  );
}
