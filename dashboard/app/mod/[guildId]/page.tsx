'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import useSWR from 'swr';
import { getCases } from '@/lib/services/mod.service';
import { useGuildInfo } from '@/hooks/use-guild-info';
import type { ModCase } from '@/lib/mod-types';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const ACTION_LABELS: Record<string, string> = {
  BAN: 'Ban', UNBAN: 'Unban', KICK: 'Kick', TIMEOUT: 'Timeout',
  WARN: 'Warning', SOFTBAN: 'Softban', TEMPBAN: 'Tempban',
  MUTE_TEXT: 'Mute (Text)', MUTE_VOICE: 'Mute (Voice)', MUTE_BOTH: 'Mute',
  UNMUTE_TEXT: 'Unmute (Text)', UNMUTE_VOICE: 'Unmute (Voice)', UNMUTE_BOTH: 'Unmute',
};

const ACTION_COLORS: Record<string, string> = {
  BAN: '#ef4444',
  WARN: '#eab308',
};

const MONO_FILLS = ['#aaaaaa', '#888888', '#666666', '#444444', '#333333'];

export default function GuildModOverview() {
  const params = useParams();
  const guildId = params.guildId as string;
  const guildInfo = useGuildInfo(guildId);

  const { data: casesData, isLoading: loading } = useSWR(
    ['overview-cases', guildId],
    () => getCases(guildId, { limit: 200 }),
  );

  const cases = casesData?.cases ?? [];

  // Aggregated stats
  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Use the real total from the API (database count), not the limited array length
    const total = casesData?.total ?? cases.length;
    const open = cases.filter((c) => c.status === 'OPEN').length;
    const recent = cases.filter((c) => new Date(c.createdAt) >= sevenDaysAgo).length;

    // Most common action
    const actionCounts: Record<string, number> = {};
    for (const c of cases) {
      actionCounts[c.action] = (actionCounts[c.action] || 0) + 1;
    }
    const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      open,
      recent,
      topAction: topAction ? ACTION_LABELS[topAction[0]] || topAction[0] : '—',
    };
  }, [cases, casesData?.total]);

  // Cases over time (last 30 days)
  const timelineData = useMemo(() => {
    const now = new Date();
    const days: { date: string; count: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: 0 });
    }

    for (const c of cases) {
      const key = new Date(c.createdAt).toISOString().slice(0, 10);
      const entry = days.find((d) => d.date === key);
      if (entry) entry.count++;
    }

    return days.map((d) => ({
      ...d,
      label: d.date.slice(5), // MM-DD
    }));
  }, [cases]);

  // Action breakdown
  const actionData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      if (c.action.startsWith('UNMUTE_')) continue;
      if (c.action === 'MUTE' || c.action.startsWith('MUTE_')) {
        counts['Mutes'] = (counts['Mutes'] || 0) + 1;
      } else {
        const label = ACTION_LABELS[c.action] || c.action;
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [cases]);

  // Recent activity (last 10)
  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [cases]);

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">
        {guildInfo?.name ?? 'Unknown Server'}
      </h1>
      <p className="mb-8 text-sm text-[var(--mod-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
        Moderation overview
      </p>

      {/* Quick stats row */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="TOTAL CASES" value={stats.total} />
        <StatCard label="OPEN CASES" value={stats.open} />
        <StatCard label="RECENT (7D)" value={stats.recent} />
        <StatCard label="TOP ACTION" value={stats.topAction} />
      </div>

      {/* Charts row */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Cases over time */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
          <h3
            className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            CASES OVER TIME (30 DAYS)
          </h3>
          {timelineData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#666666', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: '#333333' }}
                  interval={6}
                />
                <YAxis
                  tick={{ fill: '#666666', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ModChartTooltip />} />
                <Bar dataKey="count" fill="#888888" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--mod-text-dim)]">
              No cases in the last 30 days
            </div>
          )}
        </div>

        {/* Action breakdown */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
          <h3
            className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            ACTION BREAKDOWN
          </h3>
          {actionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={actionData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#666666', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="action"
                  tick={{ fill: '#aaaaaa', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  interval={0}
                />
                <Tooltip content={<ModChartTooltip />} />
                <Bar dataKey="count" radius={0}>
                  {actionData.map((entry, i) => {
                    const key = Object.entries(ACTION_LABELS).find(([, v]) => v === entry.action)?.[0];
                    const color = (key && ACTION_COLORS[key]) || MONO_FILLS[i % MONO_FILLS.length];
                    return <Cell key={entry.action} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--mod-text-dim)]">
              No cases to analyze
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
        <h3
          className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          RECENT ACTIVITY
        </h3>
        {recentCases.length > 0 ? (
          <div className="space-y-1">
            {recentCases.map((c) => (
              <Link
                key={c.id}
                href={`/mod/${guildId}/cases/${c.caseNumber}`}
                className="flex items-center justify-between px-2 py-2 text-sm transition-[background-color] duration-75 hover:bg-[var(--mono-850)]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs text-[var(--mod-text-dim)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    #{c.caseNumber}
                  </span>
                  <span className="text-[var(--mono-white)]">
                    {ACTION_LABELS[c.action] ?? c.action}
                  </span>
                  <span className="text-[var(--mod-text-muted)]">{c.targetTag}</span>
                </div>
                <span className="text-xs text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
            No cases found
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
      <p
        className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold text-[var(--mono-white)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </p>
    </div>
  );
}

function ModChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="border border-[var(--mono-700)] bg-[var(--mono-900)] px-3 py-2"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <p className="text-xs text-[var(--mono-white)]">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-[var(--mono-300)]">
          {entry.dataKey}: {entry.value}
        </p>
      ))}
    </div>
  );
}
