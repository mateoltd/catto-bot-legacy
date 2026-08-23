'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getEvidenceAnalytics, getCaseAnalytics } from '@/lib/services/mod.service';
import type { EvidenceAnalytics, CaseAnalytics } from '@/lib/mod-types';
import { EVIDENCE_TYPE_META } from '@/lib/mod-types';

type Period = '7d' | '30d' | '90d';

// Chart color palette
const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
];

export default function AnalyticsPage() {
  const { guildId } = useParams() as { guildId: string };
  const [period, setPeriod] = useState<Period>('30d');

  const { data: evidenceAnalytics, isLoading: evidenceLoading } = useSWR(
    ['evidence-analytics', guildId, period],
    () => getEvidenceAnalytics(guildId, period)
  );

  const { data: caseAnalytics, isLoading: caseLoading } = useSWR(
    ['case-analytics', guildId, period],
    () => getCaseAnalytics(guildId, period)
  );

  const isLoading = evidenceLoading || caseLoading;

  const totalEvidence = Object.values(evidenceAnalytics?.byType ?? {}).reduce((a, b) => a + b, 0);
  const totalCases = Object.values(caseAnalytics?.byAction ?? {}).reduce((a, b) => a + b, 0);
  const hasAnyData = totalEvidence > 0 || totalCases > 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--mono-white)]">Analytics</h1>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs ${
                period === p
                  ? 'border border-[var(--mono-500)] text-[var(--mono-white)]'
                  : 'border border-[var(--mod-border)] text-[var(--mod-text-dim)] hover:text-[var(--mod-text-muted)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-[var(--mod-text-dim)]">Loading analytics...</div>
      ) : !hasAnyData ? (
        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-[var(--mod-border)] bg-[var(--mono-900)]">
            <span className="text-lg text-[var(--mod-text-dim)]">/</span>
          </div>
          <h3 className="mb-2 text-sm font-medium text-[var(--mono-white)]">No data yet</h3>
          <p className="mx-auto max-w-xs text-xs text-[var(--mod-text-dim)]">
            Analytics will appear here once moderation cases and evidence are created in this server.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Total Evidence"
              value={totalEvidence}
            />
            <StatCard
              label="Total Cases"
              value={totalCases}
            />
            <StatCard
              label="Storage Used"
              value={formatBytes(evidenceAnalytics?.storageUsage?.totalBytes ?? 0)}
            />
            <StatCard
              label="Flagged Rate"
              value={`${((evidenceAnalytics?.flaggedRate ?? 0) * 100).toFixed(1)}%`}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Evidence volume over time */}
            <ChartCard title="Evidence Volume">
              {!evidenceAnalytics?.volumeOverTime?.length ? (
                <p className="py-6 text-center text-xs text-[var(--mod-text-dim)]">No evidence data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={evidenceAnalytics.volumeOverTime}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      tick={{ fill: 'var(--mod-text-dim)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--mod-border)' }}
                    />
                    <YAxis
                      tick={{ fill: 'var(--mod-text-dim)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--mod-border)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--mono-900)',
                        border: '1px solid var(--mod-border)',
                        color: 'var(--mono-white)',
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Cases volume over time */}
            <ChartCard title="Case Volume">
              {!caseAnalytics?.volumeOverTime?.length ? (
                <p className="py-6 text-center text-xs text-[var(--mod-text-dim)]">No case data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={caseAnalytics.volumeOverTime}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      tick={{ fill: 'var(--mod-text-dim)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--mod-border)' }}
                    />
                    <YAxis
                      tick={{ fill: 'var(--mod-text-dim)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--mod-border)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--mono-900)',
                        border: '1px solid var(--mod-border)',
                        color: 'var(--mono-white)',
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#a855f7" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Evidence by type */}
            <ChartCard title="Evidence by Type">
              {!evidenceAnalytics?.byType || Object.keys(evidenceAnalytics.byType).length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--mod-text-dim)]">No evidence types to display.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie
                        data={Object.entries(evidenceAnalytics.byType).map(([type, count]) => ({
                          name: EVIDENCE_TYPE_META[type as keyof typeof EVIDENCE_TYPE_META]?.label ?? type,
                          value: count,
                        }))}
                        innerRadius={30}
                        outerRadius={50}
                        dataKey="value"
                      >
                        {Object.keys(evidenceAnalytics.byType).map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1 text-xs">
                    {Object.entries(evidenceAnalytics.byType).map(([type, count], idx) => (
                      <div key={type} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="text-[var(--mod-text-muted)]">
                          {EVIDENCE_TYPE_META[type as keyof typeof EVIDENCE_TYPE_META]?.label ?? type}
                        </span>
                        <span className="ml-auto text-[var(--mod-text-dim)]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Top uploaders */}
            <ChartCard title="Top Uploaders">
              {!evidenceAnalytics?.topUploaders?.length ? (
                <p className="py-6 text-center text-xs text-[var(--mod-text-dim)]">No uploads recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {evidenceAnalytics.topUploaders.slice(0, 5).map((uploader, idx) => (
                    <div key={uploader.userId} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-[var(--mod-text-dim)]">{idx + 1}.</span>
                      <span className="flex-1 truncate text-[var(--mod-text-muted)]">
                        {uploader.userTag}
                      </span>
                      <span className="text-[var(--mono-white)]">{uploader.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Cases by Action breakdown */}
          {caseAnalytics?.byAction && (
            <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--mono-white)]">Cases by Action</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {Object.entries(caseAnalytics.byAction)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, count]) => (
                    <div
                      key={action}
                      className="border border-[var(--mod-border)] bg-[var(--mono-900)] p-3 text-center"
                    >
                      <div className="text-lg font-bold text-[var(--mono-white)]">{count}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--mod-text-dim)]">
                        {action.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--mono-white)]">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--mono-white)]">{title}</h3>
      {children}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const negative = bytes < 0;
  const abs = Math.abs(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(abs) / Math.log(k)), sizes.length - 1);
  const value = parseFloat((abs / Math.pow(k, i)).toFixed(1));
  return `${negative ? '-' : ''}${value} ${sizes[i]}`;
}
