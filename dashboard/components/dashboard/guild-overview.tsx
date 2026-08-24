'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { IconArrowRight } from '@tabler/icons-react';
import { useGuildDashboard } from '@/components/guild-page-layout';
import { guildService } from '@/lib/services/guild.service';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function GuildOverview({ guildId }: { guildId: string }) {
  const { guild, access } = useGuildDashboard();
  const {
    data: stats,
    isLoading,
  } = useSWR(['guild-stats', guildId], () => guildService.getStats(guildId), {
    revalidateOnFocus: false,
  });

  const trackedPercentage = stats?.memberCount
    ? Math.min(100, (stats.databaseUsers / stats.memberCount) * 100)
    : 0;
  const trackedPercentageLabel =
    trackedPercentage > 0 && trackedPercentage < 1
      ? '<1%'
      : `${Math.round(trackedPercentage).toLocaleString()}%`;
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{guild.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A live snapshot of your community and Catto&apos;s reach.
          </p>
        </div>
      </header>

      <section
        className="mt-8 grid border border-border lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        aria-labelledby="server-pulse-heading"
        aria-busy={isLoading}
      >
        <div className="lg:border-r lg:border-border">
          <div className="px-6 py-8 lg:px-8">
            <h2
              id="server-pulse-heading"
              className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
            >
              Community
            </h2>

            <div className="mt-8 flex items-end gap-4">
              <p className="font-mono text-5xl font-semibold leading-none tabular-nums text-foreground sm:text-6xl">
                {stats?.memberCount.toLocaleString() ?? '—'}
              </p>
              <p className="pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Members
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 border-t border-border">
            <div className="border-r border-border px-6 py-4 lg:px-8">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Channels
              </dt>
              <dd className="mt-2 font-mono text-xl tabular-nums text-foreground">
                {stats?.channelCount.toLocaleString() ?? '—'}
              </dd>
            </div>
            <div className="px-6 py-4 lg:px-8">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Roles
              </dt>
              <dd className="mt-2 font-mono text-xl tabular-nums text-foreground">
                {stats?.roleCount.toLocaleString() ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-border px-6 py-8 lg:border-t-0 lg:px-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Member coverage
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Members with a Catto profile, used for XP, rewards, and moderation history.
              </p>
            </div>
            <p className="font-mono text-xl tabular-nums text-foreground">
              {stats ? trackedPercentageLabel : '—'}
            </p>
          </div>

          <div className="mt-8 h-1.5 w-full bg-muted" aria-hidden="true">
            <div
              className="h-full bg-foreground transition-[width] duration-300"
              style={{ width: `${trackedPercentage}%` }}
            />
          </div>
          <div
            className="mt-3 flex items-baseline justify-between gap-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            role="progressbar"
            aria-label="Tracked members"
            aria-valuemin={0}
            aria-valuemax={stats?.memberCount ?? 0}
            aria-valuenow={stats?.databaseUsers ?? 0}
          >
            <span>
              <span className="text-foreground">
                {stats?.databaseUsers.toLocaleString() ?? '—'}
              </span>{' '}
              tracked
            </span>
            <span>{stats?.memberCount.toLocaleString() ?? '—'} total</span>
          </div>
        </div>
      </section>

      <section className="py-8" aria-labelledby="workspace-heading">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="workspace-heading"
            className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            Workspace
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {guild.owner ? 'Server owner' : 'Server manager'}
          </span>
        </div>

        <dl className="mt-4 border-t border-border">
          <div className="grid gap-1 border-b border-border py-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Catto joined
            </dt>
            <dd className="font-mono text-xs text-foreground">{formatDate(stats?.joinedAt)}</dd>
          </div>
          <div className="grid gap-1 border-b border-border py-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Your access
            </dt>
            <dd className="text-sm text-foreground">
              {access.canConfigure && access.canModerate
                ? 'Configuration and moderation'
                : access.canConfigure
                  ? 'Configuration'
                  : 'Moderation'}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Server ID
            </dt>
            <dd className="break-all font-mono text-xs text-foreground">{guild.id}</dd>
          </div>
        </dl>
      </section>

      {access.canModerate && (
        <section className="pb-2 pt-1" aria-labelledby="moderation-heading">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h2 id="moderation-heading" className="font-mono text-sm font-medium text-foreground">
                Moderation workspace
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review cases, evidence, user history, and server analytics.
              </p>
            </div>
            <Link
              href={`/mod/${guild.id}`}
              className="group inline-flex w-fit items-center gap-3 border border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-foreground hover:border-muted-foreground hover:bg-accent sm:justify-self-end"
            >
              Open moderation
              <IconArrowRight
                size={14}
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
