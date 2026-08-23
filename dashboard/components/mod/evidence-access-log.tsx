'use client';

import useSWR from 'swr';
import type { EvidenceAccessLogEntry } from '@/lib/mod-types';
import { getEvidenceAccessLog } from '@/lib/services/mod.service';
import { IconEye, IconDownload, IconShare } from '@/lib/mod-icons';

interface EvidenceAccessLogProps {
  guildId: string;
  evidenceId: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  VIEW: IconEye,
  DOWNLOAD: IconDownload,
  EXPORT: IconShare,
};

const ACTION_LABELS: Record<string, string> = {
  VIEW: 'Viewed',
  DOWNLOAD: 'Downloaded',
  EXPORT: 'Exported',
};

export function EvidenceAccessLog({ guildId, evidenceId }: EvidenceAccessLogProps) {
  const { data, isLoading, error } = useSWR(
    ['evidence-access-log', guildId, evidenceId],
    () => getEvidenceAccessLog(guildId, evidenceId),
    { dedupingInterval: 60000 } // Cache for 1 minute to prevent rapid refetches
  );

  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
        Loading access log...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-red-400">
        Failed to load access log.
      </div>
    );
  }

  if (!data?.logs.length) {
    return (
      <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
        No access records yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
        Chain of Custody ({data.total} records)
      </div>
      <div className="max-h-64 space-y-1 overflow-auto">
        {data.logs.map((entry) => (
          <AccessLogEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function AccessLogEntry({ entry }: { entry: EvidenceAccessLogEntry }) {
  const Icon = ACTION_ICONS[entry.action] ?? IconEye;
  const label = ACTION_LABELS[entry.action] ?? entry.action;

  return (
    <div className="flex items-center gap-3 border-l-2 border-[var(--mod-border)] py-2 pl-3">
      <Icon size={14} className="text-[var(--mod-text-dim)]" />
      <div className="flex-1">
        <div className="text-xs text-[var(--mono-white)]">
          <span className="font-medium">{entry.userTag}</span>
          {' '}
          <span className="text-[var(--mod-text-dim)]">{label.toLowerCase()}</span>
        </div>
        <div className="text-[10px] text-[var(--mod-text-dim)]">
          {new Date(entry.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
