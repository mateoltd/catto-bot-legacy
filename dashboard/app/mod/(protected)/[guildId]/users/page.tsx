'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useSWR from 'swr';
import Link from 'next/link';
import { getModeratedUsers, type ModeratedUser } from '@/lib/services/mod.service';
import { IconSearch, IconUser, IconFlag, IconGavel, IconChevronRight, IconNote, IconX } from '@/lib/mod-icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaginationNav } from '@/hooks/use-pagination-nav';
import { useFormatter, useTranslations } from 'next-intl';


const PAGE_SIZE = 25;

export default function UsersPage() {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const searchParam = searchParams.get('search') ?? '';
  const pageParam = parseInt(searchParams.get('page') ?? '1') || 1;
  const sortParam = searchParams.get('sort') ?? 'totalCases';

  const [localSearch, setLocalSearch] = useState(searchParam);

  useEffect(() => {
    setLocalSearch(searchParam);
  }, [searchParam]);

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

  const debouncedUpdateSearch = useDebouncedCallback((value: string) => {
    updateParams({ search: value || undefined });
  }, 300);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);
      debouncedUpdateSearch(value);
    },
    [debouncedUpdateSearch]
  );

  const { data, isLoading, error } = useSWR(
    ['moderated-users', guildId, searchParam, sortParam, pageParam],
    () =>
      getModeratedUsers(guildId, {
        page: pageParam,
        limit: PAGE_SIZE,
        search: searchParam || undefined,
        sort: sortParam,
      }),
    { keepPreviousData: true }
  );

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const stats = data?.stats;

  const paginationSwipe = usePaginationNav({
    onPrev: pageParam > 1 ? () => updateParams({ page: String(pageParam - 1) }) : undefined,
    onNext: pageParam < totalPages ? () => updateParams({ page: String(pageParam + 1) }) : undefined,
  });

  return (
    <div {...paginationSwipe}>
      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">{t('users')}</h1>
      <p className="mb-6 text-sm text-[var(--mod-text-muted)]">
        {t('usersDescription')}
      </p>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
            <div className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t('uniqueUsers')}
            </div>
            <div className="mt-1 text-2xl font-bold text-[var(--mono-white)]">
              {format.number(stats.uniqueUsers)}
            </div>
          </div>
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
            <div className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t('totalCases')}
            </div>
            <div className="mt-1 text-2xl font-bold text-[var(--mono-white)]">
              {format.number(stats.totalCases)}
            </div>
          </div>
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
            <div className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t('activeFlags')}
            </div>
            <div className="mt-1 text-2xl font-bold text-[var(--mono-white)]">
              {format.number(stats.activeFlags)}
            </div>
          </div>
        </div>
      )}

      {/* Search & Sort */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mod-text-dim)]"
          />
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={t('searchUsersPlaceholder')}
            aria-label={t('searchUsersLabel')}
            className="w-full border border-[var(--mod-border)] bg-[var(--mod-surface)] py-2 pl-9 pr-4 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
          />
        </div>
        <Select
          value={sortParam}
          onValueChange={(value) => updateParams({ sort: value })}
        >
          <SelectTrigger variant="mod" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent variant="mod">
            <SelectItem value="totalCases" variant="mod">{t('mostCases')}</SelectItem>
            <SelectItem value="lastCaseDate" variant="mod">{t('recentActivity')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-[var(--mod-text-dim)]">{t('loadingUsers')}</div>
      ) : error ? (
        <div className="border border-red-500/30 bg-[var(--mod-surface)] p-8 text-center text-red-400">
          {t('failedToLoadUsers')}
        </div>
      ) : users.length === 0 ? (
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-[var(--mod-text-muted)]">
          {searchParam ? t('noUsersMatchSearch') : t('noModeratedUsers')}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <UserRow key={user.userId} user={user} guildId={guildId} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => updateParams({ page: String(pageParam - 1) })}
            disabled={pageParam <= 1}
            className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface)] disabled:opacity-30"
          >
            {t('previous')}
          </button>
          <span className="text-sm text-[var(--mod-text-dim)]">
            {t('pageOf', { page: pageParam, totalPages })}
          </span>
          <button
            onClick={() => updateParams({ page: String(pageParam + 1) })}
            disabled={pageParam >= totalPages}
            className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface)] disabled:opacity-30"
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  );
}

function UserRow({ user, guildId }: { user: ModeratedUser; guildId: string }) {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  // Server status from cache - only show badge if confirmed in server
  // 'unknown' means we haven't fetched yet (click profile to see full status)
  const showInServerBadge = user.serverStatus === 'in_server';

  // Sort actions by severity/count
  const sortedActions = Object.entries(user.caseBreakdown).sort(([, a], [, b]) => b - a);

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

  return (
    <Link
      href={`/mod/${guildId}/users/${user.userId}`}
      className="block border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4 transition-[background-color,border-color] duration-75 hover:border-[var(--mod-border-hover)] hover:bg-[var(--mod-surface-hover)]"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-12 w-12 shrink-0 border border-[var(--mod-border)] bg-[var(--mono-900)]"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--mod-border)] bg-[var(--mono-900)]">
            <IconUser size={24} className="text-[var(--mod-text-dim)]" />
          </div>
        )}

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--mono-white)]">
              {user.targetTag}
            </span>

            {/* Status badge - only show if confirmed in server */}
            {showInServerBadge && (
              <span className="flex items-center gap-1 border border-green-500/30 px-1.5 py-0.5 text-[10px] text-green-400/70">
                ✓
              </span>
            )}

            {/* Flags */}
            {user.activeFlagsCount > 0 && (
              <span className="flex items-center gap-1 border border-yellow-500 px-1.5 py-0.5 text-[10px] text-yellow-400">
                <IconFlag size={10} />
                {user.activeFlagsCount}
              </span>
            )}

            {/* Notes count */}
            {user.notesCount > 0 && (
              <span className="flex items-center gap-1 border border-[var(--mod-border)] px-1.5 py-0.5 text-[10px] text-[var(--mod-text-dim)]">
                <IconNote size={10} />
                {user.notesCount}
              </span>
            )}

            {/* User ID */}
            <span className="ml-auto hidden font-mono text-xs text-[var(--mod-text-dim)] sm:inline">
              {user.userId}
            </span>
          </div>

          {/* Case summary (simplified) */}
          <div className="mb-2 text-xs text-[var(--mod-text-dim)]">
            {sortedActions.slice(0, 3).map(([action, count], idx) => (
              <span key={action}>
                {idx > 0 && ' · '}
                {t('actionCaseCount', { count, action: actionLabel(action) })}
              </span>
            ))}
            {sortedActions.length > 3 && (
              <span> · {t('moreCount', { count: sortedActions.length - 3 })}</span>
            )}
          </div>

          {/* Footer stats */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--mod-text-dim)]">
            <span className="flex items-center gap-1">
              <IconGavel size={12} />
              {t('caseCountShort', { count: user.totalCases })}
            </span>
            {user.firstCaseDate && (
              <span>{t('firstDate', { date: format.dateTime(new Date(user.firstCaseDate), { dateStyle: 'short' }) })}</span>
            )}
            {user.lastCaseDate && (
              <span>{t('lastDate', { date: format.dateTime(new Date(user.lastCaseDate), { dateStyle: 'short' }) })}</span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <IconChevronRight size={20} className="shrink-0 text-[var(--mod-text-dim)]" />
      </div>
    </Link>
  );
}
