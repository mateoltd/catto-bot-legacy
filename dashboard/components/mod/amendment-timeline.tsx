'use client';

import type { EvidenceAmendment } from '@/lib/mod-types';
import { AMENDMENT_ACTION_ICONS, IconNote } from '@/lib/mod-icons';
import { useFormatter, useTranslations } from 'next-intl';

const NODE_COLORS: Record<string, string> = {
  FLAGGED: 'var(--mod-warning)',
  UNFLAGGED: 'var(--mod-success)',
  NOTE_ADDED: 'var(--mono-500)',
  DESCRIPTION_UPDATED: 'var(--mono-400)',
  STATUS_CHANGED: 'var(--mono-400)',
};

interface AmendmentTimelineProps {
  amendments: EvidenceAmendment[];
}

export function AmendmentTimeline({ amendments }: AmendmentTimelineProps) {
  const t = useTranslations('Moderation');
  const format = useFormatter();

  const actionLabel = (action: string) => {
    switch (action) {
      case 'NOTE_ADDED': return t('amendmentNoteAdded');
      case 'DESCRIPTION_UPDATED': return t('amendmentDescriptionUpdated');
      case 'TAGS_UPDATED': return t('amendmentTagsUpdated');
      case 'FLAGGED': return t('amendmentFlagged');
      case 'UNFLAGGED': return t('amendmentUnflagged');
      case 'STATUS_CHANGED': return t('amendmentStatusChanged');
      default: return action;
    }
  };

  if (amendments.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-[var(--mod-text-muted)]">
        {t('noAmendments')}
      </div>
    );
  }

  return (
    <div className="relative pl-5">
      {/* Vertical trunk line */}
      <div
        className="absolute left-[4px] top-2 bottom-2 w-px"
        style={{ backgroundColor: 'var(--mod-border)' }}
      />

      {amendments.map((amendment, index) => {
        const ActionIcon = AMENDMENT_ACTION_ICONS[amendment.action] ?? IconNote;
        const label = actionLabel(amendment.action);
        const nodeColor = NODE_COLORS[amendment.action] ?? 'var(--mono-800)';

        return (
          <div key={amendment.id} className="relative pb-3 last:pb-0">
            {/* Circle node */}
            <div className="absolute -left-5 top-2.5 flex items-center justify-center">
              <svg width="9" height="9" viewBox="0 0 9 9">
                <circle cx="4.5" cy="4.5" r="4" fill={nodeColor} stroke="var(--mono-900)" strokeWidth="1" />
              </svg>
            </div>

            {/* Content card */}
            <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] px-3 py-2">
              <div className="flex items-center gap-2">
                <ActionIcon size={13} style={{ color: nodeColor }} />
                <span className="text-xs font-medium text-[var(--mono-white)]">{label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[var(--mod-text-dim)]">
                  {format.dateTime(new Date(amendment.createdAt), { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

              <p className="text-[11px] text-[var(--mod-text-dim)]">
                {t('byUser', { user: amendment.amendedByTag })}
              </p>

              {amendment.reason && (
                <p className="mt-1 text-xs text-[var(--mod-text-muted)]">
                  {amendment.reason}
                </p>
              )}

              {amendment.previousValue && (
                <div className="mt-1 bg-[var(--mono-950)] px-2 py-1 text-[11px]">
                  <span className="text-[var(--mod-text-dim)]">{t('previousValue')}: </span>
                  <span className="text-red-400 line-through">{amendment.previousValue}</span>
                </div>
              )}

              {amendment.newValue && (
                <div className="mt-0.5 bg-[var(--mono-950)] px-2 py-1 text-[11px]">
                  <span className="text-[var(--mod-text-dim)]">{t('newValue')}: </span>
                  <span className="text-green-400">{amendment.newValue}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
