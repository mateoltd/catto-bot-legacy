'use client';

import useSWR from 'swr';
import type { EvidenceAccessLogEntry } from '@/lib/mod-types';
import { getEvidenceAccessLog } from '@/lib/services/mod.service';
import { IconEye, IconDownload, IconShare } from '@/lib/mod-icons';
import { useFormatter, useTranslations } from 'next-intl';

interface EvidenceAccessLogProps {
  guildId: string;
  evidenceId: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  VIEW: IconEye,
  DOWNLOAD: IconDownload,
  EXPORT: IconShare,
};

export function EvidenceAccessLog({ guildId, evidenceId }: EvidenceAccessLogProps) {
  const t = useTranslations('Moderation');
  const { data, isLoading, error } = useSWR(
    ['evidence-access-log', guildId, evidenceId],
    () => getEvidenceAccessLog(guildId, evidenceId),
    { dedupingInterval: 60000 } // Cache for 1 minute to prevent rapid refetches
  );

  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
        {t('loadingAccessLog')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-red-400">
        {t('failedAccessLog')}
      </div>
    );
  }

  if (!data?.logs.length) {
    return (
      <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
        {t('noAccessRecords')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
        {t('chainOfCustody', { count: data.total })}
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
  const t = useTranslations('Moderation');
  const format = useFormatter();
  const Icon = ACTION_ICONS[entry.action] ?? IconEye;
  const label = entry.action === 'VIEW'
    ? t('accessViewed')
    : entry.action === 'DOWNLOAD'
      ? t('accessDownloaded')
      : entry.action === 'EXPORT'
        ? t('accessExported')
        : entry.action;

  return (
    <div className="flex items-center gap-3 border-l-2 border-[var(--mod-border)] py-2 pl-3">
      <Icon size={14} className="text-[var(--mod-text-dim)]" />
      <div className="flex-1">
        <div className="text-xs text-[var(--mono-white)]">
          {t('userAccessAction', { user: entry.userTag, action: label })}
        </div>
        <div className="text-[10px] text-[var(--mod-text-dim)]">
          {format.dateTime(new Date(entry.createdAt), { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  );
}
