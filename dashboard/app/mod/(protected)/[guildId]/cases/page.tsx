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
import { useFormatter, useTranslations } from 'next-intl';

const PAGE_SIZE = 25;

export default function CasesPage() {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const actionParam = searchParams.get('action') ?? '';
  const sortParam = searchParams.get('sort') ?? 'createdAt:desc';
  const searchParam = searchParams.get('search') ?? '';
  const pageParam = parseInt(searchParams.get('page') ?? '1') || 1;
  const targetIdParam = searchParams.get('targetId') ?? '';

  const actionLabel = (action: string) => {
    switch (action) {
      case 'BAN': return t('actionBan');
      case 'UNBAN': return t('actionUnban');
      case 'KICK': return t('actionKick');
      case 'TIMEOUT': return t('actionTimeout');
      case 'WARN': return t('actionWarning');
      case 'SOFTBAN': return t('actionSoftban');
      case 'TEMPBAN': return t('actionTempban');
      case 'MUTE_TEXT': return t('actionMuteText');
      case 'MUTE_VOICE': return t('actionMuteVoice');
      case 'MUTE_BOTH': return t('actionMute');
      case 'UNMUTE_TEXT': return t('actionUnmuteText');
      case 'UNMUTE_VOICE': return t('actionUnmuteVoice');
      case 'UNMUTE_BOTH': return t('actionUnmute');
      default: return action;
    }
  };

  const actionFilters = [
    { value: '', label: t('allActions') },
    ...['BAN', 'KICK', 'TIMEOUT', 'WARN', 'SOFTBAN', 'TEMPBAN', 'UNBAN', 'MUTE_BOTH', 'UNMUTE_BOTH']
      .map((value) => ({ value, label: actionLabel(value) })),
  ];

  const sortOptions = [
    { value: 'createdAt:desc', label: t('sortNewest') },
    { value: 'createdAt:asc', label: t('sortOldest') },
    { value: 'caseNumber:desc', label: t('sortCaseDescending') },
    { value: 'caseNumber:asc', label: t('sortCaseAscending') },
  ];

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
      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">{t('cases')}</h1>
      <p className="mb-6 text-sm text-[var(--mod-text-muted)]">{t('totalCasesCount', { count: total })}</p>

      {targetIdParam && (
        <div className="mb-4 flex items-center gap-2 border border-[var(--mod-border)] bg-[var(--mod-surface)] px-3 py-2 text-xs text-[var(--mod-text-muted)]">
          <span>{t('filteringByUser')} <span className="font-mono text-[var(--mono-white)]">{targetIdParam}</span></span>
          <button
            type="button"
            onClick={() => updateParams({ targetId: undefined })}
            className="ml-auto text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
          >
            {t('clearFilter')}
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
            <SelectValue placeholder={t('allActions')} />
          </SelectTrigger>
          <SelectContent variant="mod">
            {actionFilters.map((f) => (
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
            {sortOptions.map((o) => (
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
          placeholder={t('searchCasesPlaceholder')}
          className="w-40 border border-[var(--mod-border)] bg-[var(--mono-950)] px-2.5 py-1.5 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--mod-text-dim)]">{t('loadingCases')}</div>
      ) : cases.length === 0 ? (
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-[var(--mod-text-muted)]">
          {hasFilters ? t('noCasesMatchFilters') : t('noCasesFound')}
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
                      {actionLabel(c.action)}
                    </span>
                    <span className="ml-2 text-sm text-[var(--mod-text-muted)]">
                      {c.targetTag}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--mod-text-dim)] md:justify-end">
                  {c.status === 'CLOSED' && (
                    <IconLock size={14} className="text-[var(--mod-text-dim)]" title={t('statusClosed')} />
                  )}
                  {c.status === 'VOID' && (
                    <span className="border border-red-800 px-2 py-0.5 text-red-400">{t('statusVoid')}</span>
                  )}
                  <span>{format.dateTime(new Date(c.createdAt), { dateStyle: 'short' })}</span>
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
            {t('previous')}
          </button>
          <span className="text-sm text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {t('pageOf', { page: pageParam, totalPages })}
          </span>
          <button
            onClick={() => updateParams({ page: String(pageParam + 1) })}
            disabled={pageParam >= totalPages}
            className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface)] disabled:opacity-30"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {t('next')}
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
