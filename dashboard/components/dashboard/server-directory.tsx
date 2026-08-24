'use client';

import { useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconServer,
} from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { ServerAccessBadges } from '@/components/dashboard/server-access-badges';
import { ServerCard } from '@/components/dashboard/server-card';
import {
  ServerToolbar,
  type ServerViewMode,
} from '@/components/dashboard/server-toolbar';
import type { DashboardGuild } from '@/lib/server/dashboard-data';

interface ServerDirectoryProps {
  guilds: DashboardGuild[];
  isBotApiAvailable: boolean;
  isModerationApiAvailable: boolean;
  notice?: string;
}

export function ServerDirectory({
  guilds,
  isBotApiAvailable,
  isModerationApiAvailable,
  notice,
}: ServerDirectoryProps) {
  const locale = useLocale();
  const t = useTranslations('Servers');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ServerViewMode>('grid');

  const { availableGuilds, unavailableGuilds } = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const filteredGuilds = guilds
      .filter((guild) => guild.name.toLocaleLowerCase(locale).includes(normalizedQuery))
      .sort((left, right) => {
        if (left.owner !== right.owner) return Number(right.owner) - Number(left.owner);
        return left.name.localeCompare(right.name, locale);
      });

    return {
      availableGuilds: filteredGuilds.filter(
        (guild) => guild.canConfigure || guild.canModerate,
      ),
      unavailableGuilds: filteredGuilds.filter(
        (guild) => !guild.canConfigure && !guild.canModerate,
      ),
    };
  }, [guilds, locale, query]);

  const availableCount = guilds.filter(
    (guild) => guild.canConfigure || guild.canModerate,
  ).length;

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('choose')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('availableCount', { available: availableCount, total: guilds.length })}
          </p>
        </div>
      </div>

      {(!isBotApiAvailable || !isModerationApiAvailable || notice) && (
        <div className="mb-5 flex items-start gap-3 border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-200">
          <IconAlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p>
            {notice === 'forbidden'
              ? t('noticeForbidden')
              : notice === 'unavailable'
                ? t('noticeUnavailable')
                : !isBotApiAvailable
                  ? t('noticeBotApi')
                  : t('noticeModerationApi')}
          </p>
        </div>
      )}

      <div className="mb-5">
        <ServerToolbar
          query={query}
          onQueryChange={setQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {availableGuilds.length === 0 && unavailableGuilds.length === 0 ? (
        <div className="border border-border bg-card px-6 py-14 text-center">
          <IconServer size={28} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">
            {guilds.length === 0 ? t('noShared') : t('noMatching')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {guilds.length === 0
              ? t('noSharedDescription')
              : t('noMatchingDescription')}
          </p>
        </div>
      ) : null}

      {availableGuilds.length > 0 && (
        <section aria-labelledby="available-servers-heading">
          <h2 id="available-servers-heading" className="mb-3 text-sm font-medium text-foreground">
            {t('available')}
          </h2>
          <div
            className={
              viewMode === 'grid'
                ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col gap-2'
            }
          >
            {availableGuilds.map((guild) => (
              <DashboardServerCard key={guild.id} guild={guild} compact={viewMode === 'list'} />
            ))}
          </div>
        </section>
      )}

      {unavailableGuilds.length > 0 && (
        <section
          aria-labelledby="other-servers-heading"
          className={availableGuilds.length > 0 ? 'mt-8 border-t border-border pt-6' : undefined}
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="other-servers-heading" className="text-sm font-medium text-muted-foreground">
              {t('other')}
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {unavailableGuilds.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unavailableGuilds.map((guild) => (
              <DashboardServerCard key={guild.id} guild={guild} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DashboardServerCard({ guild, compact }: { guild: DashboardGuild; compact: boolean }) {
  const t = useTranslations('Servers');
  const isAvailable = guild.canConfigure || guild.canModerate;
  const status = !guild.botInstalled
    ? t('botNotConnected')
    : isAvailable
      ? (
          <ServerAccessBadges
            canConfigure={guild.canConfigure}
            canModerate={guild.canModerate}
            focusable={false}
          />
        )
      : t('noDashboardAccess');

  return (
    <ServerCard
      server={guild}
      href={`/guilds/${guild.id}`}
      status={status}
      compact={compact}
      disabled={!isAvailable}
    />
  );
}
