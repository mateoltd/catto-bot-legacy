'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { IconArrowRight } from '@tabler/icons-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useGuildDashboard } from '@/components/guild-page-layout';
import { guildService } from '@/lib/services/guild.service';

export function GuildOverview({ guildId }: { guildId: string }) {
  const { guild, access } = useGuildDashboard();
  const format = useFormatter();
  const t = useTranslations('Overview');
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
      : `${format.number(Math.round(trackedPercentage))}%`;
  const formatNumber = (value: number | undefined) =>
    value === undefined ? '—' : format.number(value);
  const joinedAt = stats?.joinedAt ? new Date(stats.joinedAt) : null;
  const joinedAtLabel =
    joinedAt && !Number.isNaN(joinedAt.getTime())
      ? format.dateTime(joinedAt, { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{guild.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('description')}
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
              {t('community')}
            </h2>

            <div className="mt-8 flex items-end gap-4">
              <p className="font-mono text-5xl font-semibold leading-none tabular-nums text-foreground sm:text-6xl">
                {formatNumber(stats?.memberCount)}
              </p>
              <p className="pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t('members')}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 border-t border-border">
            <div className="border-r border-border px-6 py-4 lg:px-8">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t('channels')}
              </dt>
              <dd className="mt-2 font-mono text-xl tabular-nums text-foreground">
                {formatNumber(stats?.channelCount)}
              </dd>
            </div>
            <div className="px-6 py-4 lg:px-8">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t('roles')}
              </dt>
              <dd className="mt-2 font-mono text-xl tabular-nums text-foreground">
                {formatNumber(stats?.roleCount)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-border px-6 py-8 lg:border-t-0 lg:px-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t('memberCoverage')}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {t('memberCoverageDescription')}
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
            aria-label={t('trackedMembers')}
            aria-valuemin={0}
            aria-valuemax={stats?.memberCount ?? 0}
            aria-valuenow={stats?.databaseUsers ?? 0}
          >
            <span>
              <span className="text-foreground">
                {formatNumber(stats?.databaseUsers)}
              </span>{' '}
              {t('tracked')}
            </span>
            <span>{formatNumber(stats?.memberCount)} {t('total')}</span>
          </div>
        </div>
      </section>

      <section className="py-8" aria-labelledby="workspace-heading">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="workspace-heading"
            className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            {t('workspace')}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {guild.owner ? t('serverOwner') : t('serverManager')}
          </span>
        </div>

        <dl className="mt-4 border-t border-border">
          <div className="grid gap-1 border-b border-border py-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t('cattoJoined')}
            </dt>
            <dd className="font-mono text-xs text-foreground">{joinedAtLabel}</dd>
          </div>
          <div className="grid gap-1 border-b border-border py-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t('yourAccess')}
            </dt>
            <dd className="text-sm text-foreground">
              {access.canConfigure && access.canModerate
                ? t('configurationAndModeration')
                : access.canConfigure
                  ? t('configuration')
                  : t('moderation')}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t('serverId')}
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
                {t('moderationWorkspace')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('moderationDescription')}
              </p>
            </div>
            <Link
              href={`/mod/${guild.id}`}
              className="group inline-flex w-fit items-center gap-3 border border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-foreground hover:border-muted-foreground hover:bg-accent sm:justify-self-end"
            >
              {t('openModeration')}
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
