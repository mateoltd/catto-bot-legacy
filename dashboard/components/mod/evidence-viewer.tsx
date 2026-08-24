'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import type { Evidence, EvidenceAmendment, VideoTimestamp } from '@/lib/mod-types';
import { EVIDENCE_TYPE_META } from '@/lib/mod-types';
import { getEvidenceViewUrl, getEvidenceHistory, amendEvidence } from '@/lib/services/mod.service';
import { EVIDENCE_TYPE_ICONS, IconX, IconDownload, IconFile, IconFlag } from '@/lib/mod-icons';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SnapshotViewer } from './snapshot-viewer';
import { AmendmentTimeline } from './amendment-timeline';
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { EvidenceAccessLog } from './evidence-access-log';
import { OGCard } from './og-card';
import { TagSelector } from './tag-selector';
import { useEscapeClose } from '@/hooks/use-escape-close';
import { useSwipe } from '@/hooks/use-swipe';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFormatter, useTranslations } from 'next-intl';

interface EvidenceViewerProps {
  guildId: string;
  evidenceId: string;
  caseNumber?: number;
  evidence: Evidence;
  onClose: () => void;
  onDownload?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

type ViewerTab = 'details' | 'history' | 'access-log' | 'amend';

export function EvidenceViewer({
  guildId,
  evidenceId,
  caseNumber,
  evidence,
  onClose,
  onDownload,
  onPrev,
  onNext,
}: EvidenceViewerProps) {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  // Derive sync values from props (no useEffect needed for URL/snapshot types)
  const syncViewUrl = useMemo(() => {
    if (evidence.type === 'URL' || evidence.type === 'DISCORD_URL') return evidence.url;
    return null;
  }, [evidence]);

  const needsAsyncLoad = !!(
    evidence.storageKey &&
    evidence.type !== 'URL' &&
    evidence.type !== 'DISCORD_URL'
  );

  const [activeTab, setActiveTab] = useState<ViewerTab>('details');

  // Amend form state
  const [amendAction, setAmendAction] = useState('NOTE_ADDED');
  const [amendReason, setAmendReason] = useState('');
  const [amendNewValue, setAmendNewValue] = useState('');
  const [amendTags, setAmendTags] = useState<string[]>(evidence.tags ?? []);
  const [amendSubmitting, setAmendSubmitting] = useState(false);
  const [flagged, setFlagged] = useState(evidence.status === 'FLAGGED');
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  useEffect(() => {
    setFlagged(evidence.status === 'FLAGGED');
  }, [evidence.status]);

  // Async URL fetch (presigned URLs for file-backed evidence)
  const {
    data: asyncViewUrl,
    error: urlError,
    isLoading: asyncLoading,
  } = useSWR(needsAsyncLoad ? ['evidence-view-url', guildId, evidenceId] : null, () =>
    getEvidenceViewUrl(guildId, evidenceId)
  );

  const viewUrl = syncViewUrl ?? asyncViewUrl ?? null;
  const loading = needsAsyncLoad ? asyncLoading : false;
  const error = urlError
    ? t('failedToLoadEvidence')
    : needsAsyncLoad && !asyncLoading && !asyncViewUrl
      ? t('couldNotGenerateViewUrl')
      : null;

  // History (only fetches when history tab is active)
  const {
    data: amendments = [],
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR(activeTab === 'history' ? ['evidence-history', guildId, evidenceId] : null, () =>
    getEvidenceHistory(guildId, evidenceId)
  );

  useEscapeClose(onClose);

  const isMobile = useIsMobile();
  const swipeHandlers = useSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    onSwipeDown: onClose,
  });

  const handleToggleFlag = async (pressed: boolean) => {
    setFlagSubmitting(true);
    try {
      await amendEvidence(guildId, evidenceId, {
        action: pressed ? 'FLAGGED' : 'UNFLAGGED',
        reason: pressed ? t('reasonFlagged') : t('reasonUnflagged'),
      });
      setFlagged(pressed);
      mutateHistory();
    } catch (err) {
      console.error('Failed to toggle flag:', err);
    } finally {
      setFlagSubmitting(false);
    }
  };

  const handleAmendSubmit = async () => {
    setAmendSubmitting(true);
    try {
      const newValue =
        amendAction === 'TAGS_UPDATED'
          ? JSON.stringify(amendTags)
          : amendNewValue.trim() || undefined;
      await amendEvidence(guildId, evidenceId, {
        action: amendAction,
        newValue,
        reason: amendReason.trim() || undefined,
      });
      setAmendReason('');
      setAmendNewValue('');
      setActiveTab('history');
      mutateHistory();
    } catch {
      // silent
    } finally {
      setAmendSubmitting(false);
    }
  };

  const typeMeta = EVIDENCE_TYPE_META[evidence.type];
  const TypeIcon = EVIDENCE_TYPE_ICONS[evidence.type];
  const typeLabel = evidence.type === 'IMAGE' ? t('evidenceImage')
    : evidence.type === 'VIDEO' ? t('evidenceVideo')
      : evidence.type === 'AUDIO' ? t('evidenceAudio')
        : evidence.type === 'DOCUMENT' ? t('evidenceDocument')
          : evidence.type === 'URL' ? t('evidenceUrl')
            : evidence.type === 'DISCORD_URL' ? t('evidenceDiscordLink')
              : t('evidenceSnapshot');

  const tabLabel = (tab: ViewerTab) => {
    switch (tab) {
      case 'details': return t('details');
      case 'history': return t('history');
      case 'access-log': return t('accessLog');
      case 'amend': return t('amend');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-auto border border-[var(--mod-border)] bg-[var(--mono-900)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon size={20} className={typeMeta.className} />
            <h2 className="text-lg font-semibold text-[var(--mono-white)]">{typeLabel}</h2>
            {evidence.originalFilename && (
              <span className="text-sm text-[var(--mod-text-dim)]">
                — {evidence.originalFilename}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-1 text-[var(--mod-text-dim)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
                title={t('download')}
                aria-label={t('download')}
              >
                <IconDownload size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label={t('close')}
              className="p-1 text-[var(--mod-text-dim)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[200px]" {...(isMobile ? swipeHandlers : {})}>
          {loading && (
            <div className="flex h-[200px] items-center justify-center text-[var(--mod-text-dim)]">
              {t('loading')}
            </div>
          )}

          {error && (
            <div className="flex h-[200px] items-center justify-center text-red-400">{error}</div>
          )}

          {!loading && !error && <EvidenceContent evidence={evidence} viewUrl={viewUrl} guildId={guildId} />}
        </div>

        {/* Tabbed bottom section */}
        <div className="mt-4 border-t border-[var(--mod-border)]">
          <div className="flex border-b border-[var(--mod-border)]">
            {(['details', 'history', 'access-log', 'amend'] as ViewerTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-[background-color] duration-75 ${
                  activeTab === tab
                    ? 'border-b-2 border-[var(--mono-white)] text-[var(--mono-white)]'
                    : 'text-[var(--mod-text-dim)] hover:text-[var(--mod-text-muted)]'
                }`}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>

          <div className="pt-4">
            {/* Details tab */}
            {activeTab === 'details' && (
              <div>
                <div className="flex flex-wrap gap-4 text-xs text-[var(--mod-text-dim)]">
                  <span>{t('uploadedByUser', { user: evidence.uploadedByTag })}</span>
                  <span>{format.dateTime(new Date(evidence.createdAt), { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {evidence.sizeBytes && <span>{t('kilobytes', { size: format.number(evidence.sizeBytes / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</span>}
                  {evidence.contentHash && (
                    <span className="font-mono">
                      {t('sha256Value', { hash: `${evidence.contentHash.slice(0, 16)}…` })}
                    </span>
                  )}
                  {evidence.status === 'VERIFIED' && (
                    <span className="text-green-400">{t('signedAndVerified')}</span>
                  )}
                </div>
                {evidence.description && (
                  <div className="mt-3 border border-[var(--mod-border)] bg-[var(--mod-surface)] p-3 text-sm text-[var(--mod-text-muted)]">
                    {evidence.description}
                  </div>
                )}
                {/* Tags */}
                {evidence.tags && evidence.tags.length > 0 && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                      {t('tags')}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {evidence.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border border-[var(--mod-border)] px-2 py-0.5 text-xs text-[var(--mod-text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {activeTab === 'history' && (
              <div>
                {historyLoading ? (
                  <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
                    {t('loadingHistory')}
                  </div>
                ) : (
                  <AmendmentTimeline amendments={amendments} />
                )}
              </div>
            )}

            {/* Access Log tab */}
            {activeTab === 'access-log' && (
              <EvidenceAccessLog guildId={guildId} evidenceId={evidenceId} />
            )}

            {/* Amend tab */}
            {activeTab === 'amend' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                    {t('action')}
                  </label>
                  <Toggle
                    variant="mod"
                    size="sm"
                    pressed={flagged}
                    onPressedChange={handleToggleFlag}
                    disabled={flagSubmitting}
                    aria-label={t('toggleFlag')}
                  >
                    <IconFlag size={14} />
                    {flagged ? t('statusFlagged') : t('flag')}
                  </Toggle>
                </div>
                <div>
                  <Select value={amendAction} onValueChange={setAmendAction}>
                    <SelectTrigger variant="mod" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent variant="mod">
                      <SelectItem value="NOTE_ADDED" variant="mod">{t('addNote')}</SelectItem>
                      <SelectItem value="DESCRIPTION_UPDATED" variant="mod">{t('updateDescription')}</SelectItem>
                      <SelectItem value="TAGS_UPDATED" variant="mod">{t('updateTags')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {amendAction === 'DESCRIPTION_UPDATED' && (
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                      {t('newValue')}
                    </label>
                    <input
                      type="text"
                      value={amendNewValue}
                      onChange={(e) => setAmendNewValue(e.target.value)}
                      placeholder={t('newDescriptionPlaceholder')}
                      className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
                    />
                  </div>
                )}

                {amendAction === 'TAGS_UPDATED' && (
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                      {t('tags')}
                    </label>
                    <TagSelector value={amendTags} onChange={setAmendTags} />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                    {t('reason')}
                  </label>
                  <textarea
                    value={amendReason}
                    onChange={(e) => setAmendReason(e.target.value)}
                    placeholder={t('reasonForAmendmentPlaceholder')}
                    rows={2}
                    className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
                  />
                </div>

                <button
                  onClick={handleAmendSubmit}
                  disabled={amendSubmitting}
                  className="border border-[var(--mono-500)] px-4 py-1.5 text-sm text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] disabled:opacity-30"
                >
                  {amendSubmitting ? t('submitting') : t('submitAmendment')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceContent({ evidence, viewUrl, guildId }: { evidence: Evidence; viewUrl: string | null; guildId: string }) {
  const t = useTranslations('Moderation');
  const { type } = evidence;

  // URL types
  if (type === 'URL' || type === 'DISCORD_URL') {
    const og = (evidence.metadata as Record<string, unknown> | null)?.og as
      | { title?: string; description?: string; image?: string; siteName?: string }
      | undefined;
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {og && <OGCard og={og} url={evidence.url ?? '#'} />}
        <a
          href={evidence.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-[var(--mono-300)] underline hover:text-[var(--mono-white)]"
        >
          {evidence.url}
        </a>
        {type === 'DISCORD_URL' && (
          <p className="text-xs text-yellow-400">
            {t('discordLinksMayExpire')}
          </p>
        )}
      </div>
    );
  }

  // Message snapshot
  if (type === 'MESSAGE_SNAPSHOT' && evidence.snapshot) {
    return <SnapshotViewer snapshot={evidence.snapshot} />;
  }

  if (!viewUrl) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[var(--mod-text-dim)]">
        {t('noPreviewAvailable')}
      </div>
    );
  }

  // Image
  if (type === 'IMAGE') {
    return (
      <div className="flex justify-center">
        <img
          src={viewUrl}
          alt={evidence.originalFilename ?? t('evidenceImage')}
          className="max-h-[60vh] object-contain"
        />
      </div>
    );
  }

  // Video
  if (type === 'VIDEO') {
    const timestamps = ((evidence.metadata as Record<string, unknown> | null)?.timestamps ?? []) as VideoTimestamp[];
    return (
      <VideoPlayer
        src={viewUrl}
        guildId={guildId}
        evidenceId={evidence.id}
        timestamps={timestamps}
      />
    );
  }

  // Audio
  if (type === 'AUDIO') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <AudioPlayer src={viewUrl} />
      </div>
    );
  }

  // Document / fallback
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <IconFile size={40} className="text-[var(--mono-400)]" />
      <p className="text-sm text-[var(--mod-text-muted)]">
        {evidence.originalFilename ?? t('evidenceDocument')}
      </p>
      <a
        href={viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-[var(--mod-border)] px-4 py-2 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)]"
      >
        {t('download')}
      </a>
    </div>
  );
}
