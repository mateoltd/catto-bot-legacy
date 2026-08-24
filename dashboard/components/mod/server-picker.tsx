'use client';

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import useSWR from 'swr';
import { ServerCard } from '@/components/dashboard/server-card';
import {
  ServerToolbar,
  type ServerViewMode,
} from '@/components/dashboard/server-toolbar';
import { AccountSwitcher } from './account-switcher';
import { cacheGuildInfo } from '@/hooks/use-guild-info';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface UserSession {
  user: {
    id: string;
    username: string;
    avatar: string | null;
  };
  guilds: Guild[];
}

interface ServerPickerProps {
  session: UserSession;
}

const STORAGE_KEY_VIEW = 'mod:view-mode';
const STORAGE_KEY_RECENT = 'mod:recent-guilds';
interface UserModStats {
  totalActions: number;
  last30dActions: number;
  last7dActions: number;
  actionBreakdown: { action: string; count: number }[];
  activityTimeline: { label: string; count: number }[];
  topGuilds: { guildId: string; guildName: string; count: number }[];
}

interface ActivityCase {
  action: string;
  createdAt: string;
  guildId: string;
  moderatorId: string;
}

interface CasesResponse {
  cases?: Omit<ActivityCase, 'guildId'>[];
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: string | number;
}

function getStoredViewMode(): ServerViewMode {
  if (typeof window === 'undefined') return 'grid';
  return (localStorage.getItem(STORAGE_KEY_VIEW) as ServerViewMode) || 'grid';
}

function getRecentGuilds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT) || '[]');
  } catch {
    return [];
  }
}

const ACTION_LABELS: Record<string, string> = {
  BAN: 'Ban',
  UNBAN: 'Unban',
  KICK: 'Kick',
  TIMEOUT: 'Timeout',
  WARN: 'Warning',
  SOFTBAN: 'Softban',
  TEMPBAN: 'Tempban',
  MUTE_TEXT: 'Mute (Text)',
  MUTE_VOICE: 'Mute (Voice)',
  MUTE_BOTH: 'Mute',
  UNMUTE_TEXT: 'Unmute (Text)',
  UNMUTE_VOICE: 'Unmute (Voice)',
  UNMUTE_BOTH: 'Unmute',
};

export function ServerPicker({ session }: ServerPickerProps) {
  const { guilds, user } = session;
  const [search, setSearch] = useState('');
  const [preferences, setPreferences] = useState<{
    viewMode: ServerViewMode;
    recentIds: string[];
  }>({ viewMode: 'grid', recentIds: [] });
  const { viewMode, recentIds } = preferences;

  useEffect(() => {
    // localStorage is unavailable to the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences({ viewMode: getStoredViewMode(), recentIds: getRecentGuilds() });
  }, []);

  const { data: userStats, isLoading: statsLoading } = useSWR(
    guilds.length > 0 ? ['user-mod-stats', user.id, guilds.map((guild) => guild.id).join(',')] : null,
    async () => {
      const currentModGuilds = guilds;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const allCases: ActivityCase[] = [];

      const results = await Promise.allSettled(
        currentModGuilds.map((g) =>
          fetch(`/api/guilds/${g.id}/moderation/cases?limit=200`, {
            credentials: 'include',
          })
            .then(async (response) => {
              if (!response.ok) return [];
              const data = (await response.json()) as CasesResponse;
              return (data.cases ?? []).map((modCase) => ({ ...modCase, guildId: g.id }));
            })
        )
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          allCases.push(...r.value);
        }
      }

      const myCases = allCases.filter((c) => c.moderatorId === user.id);
      const totalActions = myCases.length;
      const last30d = myCases.filter((c) => new Date(c.createdAt) >= thirtyDaysAgo);
      const last7d = myCases.filter((c) => new Date(c.createdAt) >= sevenDaysAgo);

      const actionCounts: Record<string, number> = {};
      const muteBreakdown: Record<string, number> = {};
      for (const c of myCases) {
        if (c.action.startsWith('UNMUTE_')) continue;
        if (c.action.startsWith('MUTE_')) {
          const label = ACTION_LABELS[c.action] || c.action;
          muteBreakdown[label] = (muteBreakdown[label] || 0) + 1;
        } else {
          const label = ACTION_LABELS[c.action] || c.action;
          actionCounts[label] = (actionCounts[label] || 0) + 1;
        }
      }
      const muteTotal = Object.values(muteBreakdown).reduce((a, b) => a + b, 0);
      if (muteTotal > 0) {
        actionCounts['Mutes'] = muteTotal;
      }
      const actionBreakdown = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const days: { label: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        days.push({ label: key.slice(5), count: 0 });
      }
      for (const c of last30d) {
        const key = new Date(c.createdAt).toISOString().slice(5, 10);
        const entry = days.find((d) => d.label === key);
        if (entry) entry.count++;
      }

      const guildCounts: Record<string, number> = {};
      for (const c of myCases) {
        guildCounts[c.guildId] = (guildCounts[c.guildId] || 0) + 1;
      }
      const topGuilds = Object.entries(guildCounts)
        .map(([guildId, count]) => ({
          guildId,
          guildName: currentModGuilds.find((g) => g.id === guildId)?.name || guildId,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        totalActions,
        last30dActions: last30d.length,
        last7dActions: last7d.length,
        actionBreakdown,
        activityTimeline: days,
        topGuilds,
      } as UserModStats;
    },
    { revalidateOnFocus: false }
  );

  const updateViewMode = (next: ServerViewMode) => {
    setPreferences((current) => ({ ...current, viewMode: next }));
    localStorage.setItem(STORAGE_KEY_VIEW, next);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return guilds;
    const q = search.toLowerCase();
    return guilds.filter((g) => g.name.toLowerCase().includes(q));
  }, [guilds, search]);

  const recentGuilds = useMemo(() => {
    return recentIds
      .map((id) => guilds.find((g) => g.id === id))
      .filter((g): g is Guild => g !== undefined)
      .slice(0, 4);
  }, [recentIds, guilds]);

  const handleGuildClick = (guild: Guild) => {
    // Pre-cache guild info so sidebar loads instantly
    cacheGuildInfo({ id: guild.id, name: guild.name, icon: guild.icon });

    const recent = getRecentGuilds().filter((id) => id !== guild.id);
    recent.unshift(guild.id);
    const trimmed = recent.slice(0, 10);
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(trimmed));
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="font-mono text-3xl font-bold tracking-tight text-[var(--mono-white)]">
              Moderation Dashboard
            </h1>
            <p className="font-mono mt-1 text-sm text-[var(--mod-text-muted)]">
              {guilds.length} server{guilds.length !== 1 ? 's' : ''} with mod access
            </p>
          </div>
          <AccountSwitcher variant="inline" />
        </div>

        {/* Your activity section */}
        <div className="mb-10 mt-6">
          <p className="font-mono mb-3 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
            YOUR ACTIVITY
          </p>

          {statsLoading ? (
            <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-sm text-[var(--mod-text-dim)]">
              Loading stats...
            </div>
          ) : userStats && userStats.totalActions > 0 ? (
            <>
              {/* Quick stats */}
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="TOTAL ACTIONS" value={userStats.totalActions} />
                <MiniStat label="LAST 30 DAYS" value={userStats.last30dActions} />
                <MiniStat label="LAST 7 DAYS" value={userStats.last7dActions} />
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Activity timeline */}
                <div className="flex flex-col border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
                  <h3 className="font-mono mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
                    YOUR ACTIONS (30 DAYS)
                  </h3>
                  {userStats.activityTimeline.some((d) => d.count > 0) ? (
                    <div className="min-h-[140px] flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={userStats.activityTimeline}
                          margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#666666', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                            tickLine={false}
                            axisLine={{ stroke: '#333333' }}
                            interval={6}
                          />
                          <YAxis
                            tick={{ fill: '#666666', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="count" fill="#888888" radius={0} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex min-h-[140px] flex-1 items-center justify-center text-xs text-[var(--mod-text-dim)]">
                      No actions in the last 30 days
                    </div>
                  )}
                </div>

                {/* Action breakdown + top servers */}
                <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
                  <h3 className="font-mono mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
                    ACTION BREAKDOWN
                  </h3>
                  {userStats.actionBreakdown.length > 0 ? (
                    <div className="space-y-2">
                      {userStats.actionBreakdown.map((item) => {
                        const maxCount = userStats.actionBreakdown[0].count;
                        const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                        return (
                          <div key={item.action} className="flex items-center gap-2">
                            <span className="font-mono w-16 shrink-0 text-right text-[11px] text-[var(--mod-text-muted)]">
                              {item.action}
                            </span>
                            <div className="h-3 flex-1 bg-[var(--mono-800)]">
                              <div
                                className="h-full bg-[var(--mono-500)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono w-6 shrink-0 text-right text-[11px] text-[var(--mod-text-dim)]">
                              {item.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex h-[100px] items-center justify-center text-xs text-[var(--mod-text-dim)]">
                      No data
                    </div>
                  )}

                  {/* Top servers */}
                  {userStats.topGuilds.length > 0 && (
                    <>
                      <h3 className="font-mono mb-2 mt-4 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
                        MOST ACTIVE IN
                      </h3>
                      <div className="space-y-1">
                        {userStats.topGuilds.map((g) => (
                          <div
                            key={g.guildId}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="truncate text-[var(--mod-text-muted)]">
                              {g.guildName}
                            </span>
                            <span className="font-mono shrink-0 text-[var(--mod-text-dim)]">
                              {g.count} action{g.count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-6 text-center text-sm text-[var(--mod-text-dim)]">
              No moderation activity found across your servers.
            </div>
          )}
        </div>

        <div className="mb-6">
          <ServerToolbar
            query={search}
            onQueryChange={setSearch}
            viewMode={viewMode}
            onViewModeChange={updateViewMode}
          />
        </div>

        {/* Recently visited */}
        {recentGuilds.length > 0 && !search.trim() && (
          <div className="mb-8">
            <p className="font-mono mb-3 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
              RECENTLY VISITED
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentGuilds.map((guild) => (
                <ServerCard
                  key={`recent-${guild.id}`}
                  server={guild}
                  href={`/mod/${guild.id}`}
                  status="Moderation access"
                  onClick={() => handleGuildClick(guild)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All servers */}
        <p className="font-mono mb-3 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
          SERVERS
        </p>

        {viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((guild) => (
              <ServerCard
                key={guild.id}
                server={guild}
                href={`/mod/${guild.id}`}
                status="Moderation access"
                onClick={() => handleGuildClick(guild)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((guild) => (
              <ServerCard
                key={guild.id}
                server={guild}
                href={`/mod/${guild.id}`}
                status="Moderation access"
                compact
                onClick={() => handleGuildClick(guild)}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center">
            <p className="font-mono text-[var(--mod-text-muted)]">
              {search.trim()
                ? 'No servers match your search.'
                : 'No servers with moderation access found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]">
        {label}
      </p>
      <p className="font-mono mt-1 text-xl font-bold text-[var(--mono-white)]">
        {value}
      </p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="font-mono border border-[var(--mono-700)] bg-[var(--mono-900)] px-3 py-2">
      <p className="text-xs text-[var(--mono-white)]">{label}</p>
      {payload.map((entry, index) => (
        <p key={`${entry.dataKey}-${index}`} className="text-xs text-[var(--mono-300)]">
          {entry.dataKey}: {entry.value}
        </p>
      ))}
    </div>
  );
}
