'use client';

import { useParams } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { getCases } from '@/lib/services/mod.service';
import { useGuildInfo } from '@/hooks/use-guild-info';
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

const ACTION_COLORS: Record<string, string> = {
  BAN: '#ef4444',
  WARN: '#eab308',
};

const MONO_FILLS = ['#aaaaaa', '#888888', '#666666', '#444444', '#333333'];

interface TooltipEntry {
  dataKey?: string | number;
  value?: string | number;
}

export default function GuildModOverview() {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  const params = useParams();
  const guildId = params.guildId as string;
  const guildInfo = useGuildInfo(guildId);
  const actionLabel = (action: string) => {
    switch (action) {
      case 'BAN': return t('actionBan'); case 'UNBAN': return t('actionUnban');
      case 'KICK': return t('actionKick'); case 'TIMEOUT': return t('actionTimeout');
      case 'WARN': return t('actionWarning'); case 'SOFTBAN': return t('actionSoftban');
      case 'TEMPBAN': return t('actionTempban'); case 'MUTE_TEXT': return t('actionMuteText');
      case 'MUTE_VOICE': return t('actionMuteVoice'); case 'MUTE_BOTH': return t('actionMute');
      case 'UNMUTE_TEXT': return t('actionUnmuteText'); case 'UNMUTE_VOICE': return t('actionUnmuteVoice');
      case 'UNMUTE_BOTH': return t('actionUnmute'); default: return action;
    }
  };

  const { data: casesData, isLoading: loading } = useSWR(
    ['overview-cases', guildId],
    () => getCases(guildId, { limit: 200 }),
  );

  const cases = useMemo(() => casesData?.cases ?? [], [casesData?.cases]);

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
      topAction: topAction ? actionLabel(topAction[0]) : '—',
    };
  }, [cases, casesData?.total, t]);

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
      label: d.date.slice(5),
    }));
  }, [cases]);

  // Action breakdown
  const actionData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      if (c.action.startsWith('UNMUTE_')) continue;
      if (c.action.startsWith('MUTE_')) {
        counts[t('actionMutes')] = (counts[t('actionMutes')] || 0) + 1;
      } else {
        const label = actionLabel(c.action);
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [cases, t]);

  // Recent activity (last 10)
  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [cases]);

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
        {t('loadingDashboard')}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">
        {guildInfo?.name ?? t('unknownServer')}
      </h1>
      <p className="mb-8 text-sm text-[var(--mod-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
        {t('overview')}
      </p>

      {/* Quick stats row */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('totalCases')} value={format.number(stats.total)} />
        <StatCard label={t('openCases')} value={format.number(stats.open)} />
        <StatCard label={t('recentSevenDays')} value={format.number(stats.recent)} />
        <StatCard label={t('topAction')} value={stats.topAction} />
      </div>

      {/* Charts row */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Cases over time */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
          <h3
            className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {t('casesOverTime')}
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
                <Tooltip content={<ModChartTooltip valueLabel={t('casesLower')} />} />
                <Bar dataKey="count" fill="#888888" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--mod-text-dim)]">
              {t('noCasesThirtyDays')}
            </div>
          )}
        </div>

        {/* Action breakdown */}
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
          <h3
            className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--mod-text-dim)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {t('actionBreakdown')}
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
                <Tooltip content={<ModChartTooltip valueLabel={t('casesLower')} />} />
                <Bar dataKey="count" radius={0}>
                  {actionData.map((entry, i) => {
                    const key = Object.keys(ACTION_COLORS).find((action) => actionLabel(action) === entry.action);
                    const color = (key && ACTION_COLORS[key]) || MONO_FILLS[i % MONO_FILLS.length];
                    return <Cell key={entry.action} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-[var(--mod-text-dim)]">
              {t('noCasesAnalyze')}
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
          {t('recentActivity')}
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
                    {actionLabel(c.action)}
                  </span>
                  <span className="text-[var(--mod-text-muted)]">{c.targetTag}</span>
                </div>
                <span className="text-xs text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {format.dateTime(new Date(c.createdAt), { dateStyle: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
            {t('noCasesFound')}
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

function ModChartTooltip({
  active,
  payload,
  label,
  valueLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: ReactNode;
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="border border-[var(--mono-700)] bg-[var(--mono-900)] px-3 py-2"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <p className="text-xs text-[var(--mono-white)]">{label}</p>
      {payload.map((entry, index) => (
        <p key={`${entry.dataKey}-${index}`} className="text-xs text-[var(--mono-300)]">
          {valueLabel}: {entry.value}
        </p>
      ))}
    </div>
  );
}
