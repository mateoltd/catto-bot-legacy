'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useSWR from 'swr';
import Link from 'next/link';
import { getCases } from '@/lib/services/mod.service';
import type { ModCase } from '@/lib/mod-types';
import { IconLock } from '@tabler/icons-react';
import { useSwipe } from '@/hooks/use-swipe';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaginationNav } from '@/hooks/use-pagination-nav';

const ACTION_LABELS: Record<string, string> = {
  BAN: 'Ban', UNBAN: 'Unban', KICK: 'Kick', TIMEOUT: 'Timeout',
  WARN: 'Warning', SOFTBAN: 'Softban', TEMPBAN: 'Tempban',
  MUTE_TEXT: 'Mute (Text)', MUTE_VOICE: 'Mute (Voice)', MUTE_BOTH: 'Mute',
  UNMUTE_TEXT: 'Unmute (Text)', UNMUTE_VOICE: 'Unmute (Voice)', UNMUTE_BOTH: 'Unmute',
};

const ACTION_FILTERS = [
  { value: '', label: 'All Actions' },
  { value: 'BAN', label: 'Ban' },
  { value: 'KICK', label: 'Kick' },
  { value: 'TIMEOUT', label: 'Timeout' },
  { value: 'WARN', label: 'Warning' },
  { value: 'SOFTBAN', label: 'Softban' },
  { value: 'TEMPBAN', label: 'Tempban' },
  { value: 'UNBAN', label: 'Unban' },
  { value: 'MUTE_BOTH', label: 'Mute' },
  { value: 'UNMUTE_BOTH', label: 'Unmute' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'caseNumber:desc', label: 'Case # (high-low)' },
  { value: 'caseNumber:asc', label: 'Case # (low-high)' },
];

const PAGE_SIZE = 25;

export default function CasesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const actionParam = searchParams.get('action') ?? '';
  const sortParam = searchParams.get('sort') ?? 'createdAt:desc';
  const searchParam = searchParams.get('search') ?? '';
  const pageParam = parseInt(searchParams.get('page') ?? '1') || 1;
  const targetIdParam = searchParams.get('targetId') ?? '';

  // Local state for immediate input feedback
  const [localSearch, setLocalSearch] = useState(searchParam);

  // Sync local state when URL params change externally
  useEffect(() => { setLocalSearch(searchParam); }, [searchParam]);

  const isMobile = useIsMobile();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      if (!('page' in updates)) {
        next.delete('page');
      }
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Debounced URL update for search input
  const debouncedUpdateSearch = useDebouncedCallback((value: string) => {
    updateParams({ search: value || undefined });
  }, 300);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    debouncedUpdateSearch(value);
  }, [debouncedUpdateSearch]);

  const [sortField, sortOrder] = sortParam.split(':');
  const { data: casesData, isLoading: loading } = useSWR(
    ['cases', guildId, actionParam, sortParam, searchParam, pageParam, targetIdParam],
    () => getCases(guildId, {
      page: pageParam,
      limit: PAGE_SIZE,
      sort: sortField,
      order: sortOrder,
      ...(actionParam && { action: actionParam }),
      ...(searchParam && { search: searchParam }),
      ...(targetIdParam && { targetId: targetIdParam }),
    } as Parameters<typeof getCases>[1]),
    { keepPreviousData: true },
  );

  const cases = casesData?.cases ?? [];
  const total = casesData?.total ?? 0;
  const totalPages = casesData?.totalPages ?? 1;

  const hasFilters = actionParam || searchParam || targetIdParam;

  const paginationSwipe = usePaginationNav({
    onPrev: pageParam > 1 ? () => updateParams({ page: String(pageParam - 1) }) : undefined,
    onNext: pageParam < totalPages ? () => updateParams({ page: String(pageParam + 1) }) : undefined,
  });

  return (
    <div {...paginationSwipe}>
      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">Cases</h1>
      <p className="mb-6 text-sm text-[var(--mod-text-muted)]">{total} total cases</p>

      {targetIdParam && (
        <div className="mb-4 flex items-center gap-2 border border-[var(--mod-border)] bg-[var(--mod-surface)] px-3 py-2 text-xs text-[var(--mod-text-muted)]">
          <span>Filtering by user: <span className="font-mono text-[var(--mono-white)]">{targetIdParam}</span></span>
          <button
            type="button"
            onClick={() => updateParams({ targetId: undefined })}
            className="ml-auto text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Action filter */}
        <Select
          value={actionParam || '_all'}
          onValueChange={(value) => updateParams({ action: value === '_all' ? undefined : value })}
        >
          <SelectTrigger variant="mod" className="w-[140px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent variant="mod">
            {ACTION_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value || '_all'} variant="mod">
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort select */}
        <Select
          value={sortParam}
          onValueChange={(value) => updateParams({ sort: value })}
        >
          <SelectTrigger variant="mod" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent variant="mod">
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} variant="mod">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search input */}
        <input
          type="text"
          value={localSearch}
          onChange={handleSearchChange}
          placeholder="Search by user or ID..."
          className="w-40 border border-[var(--mod-border)] bg-[var(--mono-950)] px-2.5 py-1.5 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none focus:border-[var(--mono-500)]"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--mod-text-dim)]">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-[var(--mod-text-muted)]">
          {hasFilters ? 'No cases match the current filters.' : 'No cases found.'}
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <SwipeableCaseRow
              key={c.id}
              isMobile={isMobile}
              onSwipeRight={() => router.push(`/mod/${guildId}/cases/${c.caseNumber}`)}
            >
              <Link
                href={`/mod/${guildId}/cases/${c.caseNumber}`}
                className="flex flex-col gap-2 border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4 transition-[background-color,border-color] duration-75 hover:border-[var(--mod-border-hover)] hover:bg-[var(--mod-surface-hover)] md:flex-row md:items-center md:justify-between md:gap-4"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono font-medium text-[var(--mod-text-dim)]">
                    #{c.caseNumber}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-[var(--mono-white)]">
                      {ACTION_LABELS[c.action] ?? c.action}
                    </span>
                    <span className="ml-2 text-sm text-[var(--mod-text-muted)]">
                      {c.targetTag}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--mod-text-dim)] md:justify-end">
                  {c.status === 'CLOSED' && (
                    <IconLock size={14} className="text-[var(--mod-text-dim)]" title="Closed" />
                  )}
                  {c.status === 'VOID' && (
                    <span className="border border-red-800 px-2 py-0.5 text-red-400">VOID</span>
                  )}
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            </SwipeableCaseRow>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => updateParams({ page: String(pageParam - 1) })}
            disabled={pageParam <= 1}
            className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface)] disabled:opacity-30"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Previous
          </button>
          <span className="text-sm text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
            Page {pageParam} of {totalPages}
          </span>
          <button
            onClick={() => updateParams({ page: String(pageParam + 1) })}
            disabled={pageParam >= totalPages}
            className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface)] disabled:opacity-30"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function SwipeableCaseRow({
  children,
  isMobile,
  onSwipeRight,
}: {
  children: React.ReactNode;
  isMobile: boolean;
  onSwipeRight: () => void;
}) {
  const swipeHandlers = useSwipe({ onSwipeRight });

  if (!isMobile) return <>{children}</>;

  return <div {...swipeHandlers}>{children}</div>;
}
