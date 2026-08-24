'use client';

import { useMemo, useState } from 'react';
import { Hash, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ChannelFilterItem {
  value: string;
  label: string;
}

interface ChannelFilterListProps {
  items: readonly ChannelFilterItem[];
  allowed: readonly string[];
  ignored: readonly string[];
  onAllowedChange: (value: string[]) => void;
  onIgnoredChange: (value: string[]) => void;
  emptyLabel?: string;
  searchPlaceholder?: string;
}

export function ChannelFilterList({
  items,
  allowed,
  ignored,
  onAllowedChange,
  onIgnoredChange,
  emptyLabel = 'No channels available',
  searchPlaceholder = 'Filter channels…',
}: ChannelFilterListProps) {
  const [query, setQuery] = useState('');
  const allowedSet = useMemo(() => new Set(allowed), [allowed]);
  const ignoredSet = useMemo(() => new Set(ignored), [ignored]);
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.label.toLocaleLowerCase().includes(normalized));
  }, [items, query]);

  const setPolicy = (channelId: string, policy: 'allow' | 'ignore') => {
    const isAllowed = allowedSet.has(channelId);
    const isIgnored = ignoredSet.has(channelId);

    if (policy === 'allow') {
      onAllowedChange(
        isAllowed ? allowed.filter((id) => id !== channelId) : [...allowed, channelId]
      );
      if (isIgnored) onIgnoredChange(ignored.filter((id) => id !== channelId));
      return;
    }

    onIgnoredChange(
      isIgnored ? ignored.filter((id) => id !== channelId) : [...ignored, channelId]
    );
    if (isAllowed) onAllowedChange(allowed.filter((id) => id !== channelId));
  };

  return (
    <div className="border border-border bg-input">
      {items.length > 6 && (
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="border-0 bg-transparent pl-10 focus-visible:ring-inset"
          />
        </div>
      )}

      <div className="max-h-72 divide-y divide-border overflow-y-auto">
        {visibleItems.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {items.length === 0 ? emptyLabel : 'No matching channels'}
          </p>
        ) : (
          visibleItems.map((item) => {
            const isAllowed = allowedSet.has(item.value);
            const isIgnored = ignoredSet.has(item.value);

            return (
              <div key={item.value} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground">
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </div>
                <div
                  role="group"
                  className="grid shrink-0 grid-cols-2 border border-border"
                  aria-label={`${item.label} policy`}
                >
                  <button
                    type="button"
                    aria-pressed={isAllowed}
                    onClick={() => setPolicy(item.value, 'allow')}
                    className={cn(
                      'h-8 border-r border-border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors',
                      isAllowed
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    aria-pressed={isIgnored}
                    onClick={() => setPolicy(item.value, 'ignore')}
                    className={cn(
                      'h-8 px-3 font-mono text-[10px] uppercase tracking-wider transition-colors',
                      isIgnored
                        ? 'bg-destructive text-destructive-foreground'
                        : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                    )}
                  >
                    Ignore
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{allowed.length} explicitly allowed</span>
        <span>{ignored.length} ignored</span>
        <span className="ml-auto normal-case tracking-normal">
          {allowed.length === 0
            ? 'All channels are allowed by default'
            : 'Only explicitly allowed channels award XP'}
        </span>
      </div>
    </div>
  );
}
