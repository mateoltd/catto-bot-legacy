'use client';

import useSWR from 'swr';
import type { EvidenceAmendment } from '@/lib/mod-types';
import { getEvidenceHistory } from '@/lib/services/mod.service';
import { IconX } from '@/lib/mod-icons';
import { AmendmentTimeline } from './amendment-timeline';
import { useEscapeClose } from '@/hooks/use-escape-close';
import { useTranslations } from 'next-intl';

interface EvidenceHistoryProps {
  guildId: string;
  evidenceId: string;
  onClose: () => void;
}

export function EvidenceHistory({ guildId, evidenceId, onClose }: EvidenceHistoryProps) {
  const t = useTranslations('Moderation');
  const { data: amendments = [], isLoading: loading } = useSWR(
    ['evidence-history', guildId, evidenceId],
    () => getEvidenceHistory(guildId, evidenceId),
  );

  useEscapeClose(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-auto border border-[var(--mod-border)] bg-[var(--mono-900)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--mono-white)]">{t('amendmentHistory')}</h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-1 text-[var(--mod-text-dim)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
          >
            <IconX size={18} />
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center text-[var(--mod-text-dim)]">{t('loadingHistory')}</div>
        )}

        {!loading && <AmendmentTimeline amendments={amendments} />}
      </div>
    </div>
  );
}
