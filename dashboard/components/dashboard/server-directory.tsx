'use client';

import { useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconServer,
} from '@tabler/icons-react';
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
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ServerViewMode>('grid');

  const sortedGuilds = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return guilds
      .filter((guild) => guild.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftAvailable = Number(left.canConfigure || left.canModerate);
        const rightAvailable = Number(right.canConfigure || right.canModerate);
        if (leftAvailable !== rightAvailable) return rightAvailable - leftAvailable;
        if (left.owner !== right.owner) return Number(right.owner) - Number(left.owner);
        return left.name.localeCompare(right.name);
      });
  }, [guilds, query]);

  const availableCount = guilds.filter(
    (guild) => guild.canConfigure || guild.canModerate,
  ).length;

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-border pb-6">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Server configuration
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Choose a server</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {availableCount} of {guilds.length} servers available
          </p>
        </div>
      </div>

      {(!isBotApiAvailable || !isModerationApiAvailable || notice) && (
        <div className="mb-5 flex items-start gap-3 border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-200">
          <IconAlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p>
            {notice === 'forbidden'
              ? 'You no longer have dashboard access to that server.'
              : notice === 'unavailable'
                ? 'That server is not available to the bot or your access changed.'
                : !isBotApiAvailable
                  ? 'The bot API is unavailable. Server connections cannot be verified right now.'
                  : 'Moderation access could not be verified. Configuration access is still available.'}
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

      {sortedGuilds.length === 0 ? (
        <div className="border border-border bg-card px-6 py-14 text-center">
          <IconServer size={28} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">
            {guilds.length === 0 ? 'No shared servers found' : 'No matching servers'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {guilds.length === 0
              ? 'Sign in with an account that shares a server with Catto.'
              : 'Try another server name.'}
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-2'
          }
        >
          {sortedGuilds.map((guild) => (
            <DashboardServerCard key={guild.id} guild={guild} compact={viewMode === 'list'} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardServerCard({ guild, compact }: { guild: DashboardGuild; compact: boolean }) {
  const isAvailable = guild.canConfigure || guild.canModerate;
  const status = !guild.botInstalled
    ? 'Bot not connected'
    : guild.canConfigure && guild.canModerate
      ? guild.owner
        ? 'Owner + moderation access'
        : 'Configuration + moderation access'
      : guild.canConfigure
        ? guild.owner
          ? 'Owner access'
          : 'Configuration access'
        : guild.canModerate
          ? 'Moderation access'
          : 'No dashboard access';

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
