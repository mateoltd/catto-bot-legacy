'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Evidence } from '@/lib/mod-types';
import { EVIDENCE_TYPE_META, EVIDENCE_STATUS_META } from '@/lib/mod-types';
import { EVIDENCE_TYPE_ICONS, IconEye, IconHistory, IconDownload, IconPencil, IconX, IconFlag, IconNote, IconCheck, IconGrid, IconList, IconCompare } from '@/lib/mod-icons';
import { EvidenceViewer } from './evidence-viewer';
import { EvidenceHistory } from './evidence-history';
import { EvidenceComparison } from './evidence-comparison';
import { ShortcutHelp } from './shortcut-help';
import { getEvidenceDownloadUrl, amendEvidence } from '@/lib/services/mod.service';
import { useModShortcuts } from '@/hooks/use-mod-shortcuts';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLongPress } from '@/hooks/use-long-press';
import { useSwipe } from '@/hooks/use-swipe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';

interface EvidenceGalleryProps {
  evidence: Evidence[];
  guildId: string;
  onEvidenceUpdated?: () => void;
}

type ViewMode = 'grid' | 'table';

export function EvidenceGallery({ evidence, guildId, onEvidenceUpdated }: EvidenceGalleryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [amendingId, setAmendingId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showComparison, setShowComparison] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const hasSelection = selectedIds.size > 0;
  const canCompare = selectedIds.size === 2;
  const allSelectedFlagged = hasSelection && [...selectedIds].every(
    (id) => evidence.find((e) => e.id === id)?.status === 'FLAGGED'
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = async (item: Evidence) => {
    try {
      const url = await getEvidenceDownloadUrl(guildId, item.id);
      if (url) window.open(url, '_blank');
    } catch {
      // silent
    }
  };

  const handleBulkFlag = async (flag: boolean) => {
    setBulkSubmitting(true);
    try {
      const action = flag ? 'FLAGGED' : 'UNFLAGGED';
      const reason = flag ? 'Bulk flagged' : 'Bulk unflagged';
      for (const id of selectedIds) {
        await amendEvidence(guildId, id, { action, reason });
      }
      onEvidenceUpdated?.();
    } catch {
      // silent
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDownload = async () => {
    for (const id of selectedIds) {
      const item = evidence.find((e) => e.id === id);
      if (item?.storageKey) await handleDownload(item);
    }
  };

  const handleBulkNote = async (note: string) => {
    setBulkSubmitting(true);
    try {
      for (const id of selectedIds) {
        await amendEvidence(guildId, id, { action: 'NOTE_ADDED', reason: note });
      }
      setSelectedIds(new Set());
      setBulkAction(null);
      onEvidenceUpdated?.();
    } catch {
      // silent
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Keyboard shortcuts
  useModShortcuts({
    onHelp: useCallback(() => {
      setShowHelp((prev) => !prev);
    }, []),
  });

  if (evidence.length === 0) {
    return (
      <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-[var(--mod-text-muted)]">
        No evidence has been added yet.
      </div>
    );
  }

  // Get comparison items
  const comparisonItems = (() => {
    if (!canCompare) return null;
    const found = Array.from(selectedIds).map((id) => evidence.find((e) => e.id === id)).filter(Boolean);
    return found.length === 2 ? (found as [Evidence, Evidence]) : null;
  })();

  return (
    <>
      {/* View toggle */}
      <div className="mb-3 flex items-center justify-end gap-1">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 ${viewMode === 'grid' ? 'text-[var(--mono-white)]' : 'text-[var(--mod-text-dim)]'} hover:text-[var(--mono-white)]`}
          title="Grid view"
        >
          <IconGrid size={16} />
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`p-2 ${viewMode === 'table' ? 'text-[var(--mono-white)]' : 'text-[var(--mod-text-dim)]'} hover:text-[var(--mono-white)]`}
          title="Table view"
        >
          <IconList size={16} />
        </button>
      </div>

      <div ref={galleryRef} className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2"} style={{ overscrollBehavior: 'contain' }}>
        {evidence.map((item) => {
          const typeMeta = EVIDENCE_TYPE_META[item.type];
          const statusMeta = EVIDENCE_STATUS_META[item.status];
          const TypeIcon = EVIDENCE_TYPE_ICONS[item.type];
          const isChecked = selectedIds.has(item.id);

          return (
            <GalleryCard
              key={item.id}
              isMobile={isMobile}
              hasSelection={hasSelection}
              onLongPress={() => toggleSelection(item.id)}
              onTap={() => {
                if (hasSelection) {
                  toggleSelection(item.id);
                }
              }}
              onSwipeLeftAction={() => setSelectedId(item.id)}
              onSwipeRightAction={() => toggleSelection(item.id)}
              className={`group relative min-w-0 overflow-hidden border p-4 transition-[background-color,border-color] duration-75 hover:border-[var(--mod-border-hover)] ${
                isChecked
                  ? 'border-[var(--mono-400)] bg-[var(--mono-800)]'
                  : 'border-[var(--mod-border)] bg-[var(--mod-surface)]'
              }`}
            >
              {/* Selection checkbox */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center border transition-all duration-75 ${
                  isChecked
                    ? 'border-[var(--mono-white)] bg-[var(--mono-600)]'
                    : 'border-[var(--mono-500)] bg-[var(--mono-900)] opacity-0 group-hover:opacity-100'
                }`}
              >
                {isChecked && <IconCheck size={12} className="text-[var(--mono-white)]" />}
              </button>

              {/* Header */}
              <div className="mb-3 flex items-center justify-between pr-5">
                <TypeIcon size={20} className={typeMeta.className} />
                <span className={`border px-2 py-0.5 text-xs ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
              </div>

              {/* Type label */}
              <p className="mb-1 text-sm font-medium text-[var(--mono-white)]">
                {typeMeta.label}
              </p>

              {/* Filename or URL */}
              <p className="mb-2 truncate text-xs text-[var(--mod-text-dim)]">
                {item.originalFilename ?? item.url ?? item.description ?? item.id}
              </p>

              {/* OG site name for URL types */}
              {(item.type === 'URL' || item.type === 'DISCORD_URL') && (() => {
                const og = (item.metadata as Record<string, unknown> | null)?.og as { siteName?: string } | undefined;
                return og?.siteName ? (
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--mod-text-dim)]">
                    {og.siteName}
                  </p>
                ) : null;
              })()}

              {/* Description */}
              {item.description && (
                <p className="mb-2 text-xs text-[var(--mod-text-muted)] line-clamp-2">
                  {item.description}
                </p>
              )}

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="border border-[var(--mod-border)] px-1.5 py-0.5 text-[10px] text-[var(--mod-text-dim)]">
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="px-1 text-[10px] text-[var(--mod-text-dim)]">+{item.tags.length - 3}</span>
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="mb-3 flex items-center gap-2 text-xs text-[var(--mod-text-dim)]">
                {item.sizeBytes && (
                  <span>{(item.sizeBytes / 1024).toFixed(1)} KB</span>
                )}
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Footer */}
              <p className="mb-3 text-xs text-[var(--mod-text-dim)]">
                by {item.uploadedByTag}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {(item.storageKey || item.url || item.snapshotId) && (
                  <button
                    onClick={() => setSelectedId(item.id)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 border border-[var(--mod-border)] px-2 py-1 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] md:min-h-0 md:min-w-0"
                  >
                    <IconEye size={14} />
                    {!isMobile && 'View'}
                  </button>
                )}
                {item.storageKey && (
                  <button
                    onClick={() => handleDownload(item)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 border border-[var(--mod-border)] px-2 py-1 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] md:min-h-0 md:min-w-0"
                  >
                    <IconDownload size={14} />
                    {!isMobile && 'Download'}
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(item.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 border border-[var(--mod-border)] px-2 py-1 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] md:min-h-0 md:min-w-0"
                >
                  <IconHistory size={14} />
                  {!isMobile && 'History'}
                </button>
                <button
                  onClick={() => setAmendingId(amendingId === item.id ? null : item.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 border border-[var(--mod-border)] px-2 py-1 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] md:min-h-0 md:min-w-0"
                >
                  <IconPencil size={14} />
                  {!isMobile && 'Amend'}
                </button>
              </div>

              {/* Inline amend modal */}
              {amendingId === item.id && (
                <InlineAmendForm
                  guildId={guildId}
                  evidenceId={item.id}
                  isFlagged={item.status === 'FLAGGED'}
                  onClose={() => setAmendingId(null)}
                  onAmended={() => {
                    setAmendingId(null);
                    onEvidenceUpdated?.();
                  }}
                  onEvidenceUpdated={onEvidenceUpdated}
                />
              )}
            </GalleryCard>
          );
        })}
      </div>

      {/* Bulk action bar - fixed at bottom of viewport */}
      {hasSelection && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--mono-500)] bg-[var(--mono-900)] px-4 py-2 shadow-lg md:inset-x-auto md:bottom-4 md:left-1/2 md:w-auto md:-translate-x-1/2 md:border md:px-4">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <span className="text-xs font-medium text-[var(--mod-text-muted)]">{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
            >
              <IconX size={14} />
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 md:mt-0 md:flex md:items-center md:gap-2">
            <span className="hidden text-xs text-[var(--mod-text-muted)] md:inline">{selectedIds.size} selected</span>
            {canCompare && (
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center justify-center gap-1 border border-[var(--mono-500)] px-2.5 py-1.5 text-xs text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] md:py-1"
              >
                <IconCompare size={14} />
                <span className="hidden sm:inline">Compare</span>
              </button>
            )}
            <Toggle
              variant="mod"
              size="sm"
              pressed={allSelectedFlagged}
              onPressedChange={(pressed) => handleBulkFlag(pressed)}
              disabled={bulkSubmitting}
              className="flex h-auto items-center justify-center gap-1 px-2.5 py-1.5 md:py-1"
              aria-label="Flag selected"
            >
              <IconFlag size={14} />
              {allSelectedFlagged ? 'Unflag' : 'Flag'}
            </Toggle>
            <button
              onClick={handleBulkDownload}
              className="flex items-center justify-center gap-1 border border-[var(--mod-border)] px-2.5 py-1.5 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] md:py-1"
            >
              <IconDownload size={14} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={() => setBulkAction('note')}
              className="col-span-2 flex items-center justify-center gap-1 border border-[var(--mod-border)] px-2.5 py-1.5 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] md:col-span-1 md:py-1"
            >
              <IconNote size={14} />
              Note
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="hidden text-xs text-[var(--mod-text-dim)] hover:text-[var(--mono-white)] md:ml-auto md:block"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk note modal */}
      {bulkAction === 'note' && (
        <BulkNoteModal
          count={selectedIds.size}
          onSubmit={handleBulkNote}
          onClose={() => setBulkAction(null)}
          submitting={bulkSubmitting}
        />
      )}

      {/* Viewer Modal */}
      {selectedId && (
        <EvidenceViewer
          guildId={guildId}
          evidenceId={selectedId}
          caseNumber={evidence.find((e) => e.id === selectedId)?.caseNumber}
          evidence={evidence.find((e) => e.id === selectedId)!}
          onClose={() => setSelectedId(null)}
          onDownload={
            evidence.find((e) => e.id === selectedId)?.storageKey
              ? () => handleDownload(evidence.find((e) => e.id === selectedId)!)
              : undefined
          }
          onPrev={() => {
            const idx = evidence.findIndex((e) => e.id === selectedId);
            if (idx > 0) setSelectedId(evidence[idx - 1].id);
          }}
          onNext={() => {
            const idx = evidence.findIndex((e) => e.id === selectedId);
            if (idx < evidence.length - 1) setSelectedId(evidence[idx + 1].id);
          }}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <EvidenceHistory
          guildId={guildId}
          evidenceId={showHistory}
          onClose={() => setShowHistory(null)}
        />
      )}

      {/* Shortcut help */}
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}

      {/* Comparison Modal */}
      {showComparison && comparisonItems && (
        <EvidenceComparison
          guildId={guildId}
          items={comparisonItems}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}

function GalleryCard({
  children,
  className,
  isMobile,
  hasSelection,
  onLongPress,
  onTap,
  onSwipeLeftAction,
  onSwipeRightAction,
}: {
  children: React.ReactNode;
  className: string;
  isMobile: boolean;
  hasSelection: boolean;
  onLongPress: () => void;
  onTap: () => void;
  onSwipeLeftAction?: () => void;
  onSwipeRightAction?: () => void;
}) {
  const longPressHandlers = useLongPress({ onLongPress });
  const swipeHandlers = useSwipe({
    onSwipeLeft: onSwipeLeftAction,
    onSwipeRight: onSwipeRightAction,
  });

  if (isMobile) {
    return (
      <div
        className={className}
        {...longPressHandlers}
        onPointerDown={(e) => {
          longPressHandlers.onPointerDown(e);
          swipeHandlers.onPointerDown(e);
        }}
        onPointerUp={(e) => {
          longPressHandlers.onPointerUp();
          swipeHandlers.onPointerUp(e);
        }}
        onPointerCancel={(e) => {
          longPressHandlers.onPointerCancel();
          swipeHandlers.onPointerCancel();
        }}
        onPointerLeave={() => {
          longPressHandlers.onPointerLeave();
        }}
        onClickCapture={(e) => {
          longPressHandlers.onClick(e);
          if (!e.defaultPrevented && hasSelection) {
            e.stopPropagation();
            onTap();
          } else if (!e.defaultPrevented) {
            onTap();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={className} onClick={onTap}>
      {children}
    </div>
  );
}

function InlineAmendForm({
  guildId,
  evidenceId,
  isFlagged,
  onClose,
  onAmended,
  onEvidenceUpdated,
}: {
  guildId: string;
  evidenceId: string;
  isFlagged: boolean;
  onClose: () => void;
  onAmended: () => void;
  onEvidenceUpdated?: () => void;
}) {
  const [action, setAction] = useState('NOTE_ADDED');
  const [reason, setReason] = useState('');
  const [newValue, setNewValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flagged, setFlagged] = useState(isFlagged);
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  useEffect(() => {
    setFlagged(isFlagged);
  }, [isFlagged]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await amendEvidence(guildId, evidenceId, {
        action,
        newValue: newValue.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      onAmended();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFlag = async (pressed: boolean) => {
    setFlagSubmitting(true);
    try {
      await amendEvidence(guildId, evidenceId, {
        action: pressed ? 'FLAGGED' : 'UNFLAGGED',
        reason: pressed ? 'Flagged' : 'Unflagged',
      });
      setFlagged(pressed);
      onEvidenceUpdated?.();
    } catch {
      // silent
    } finally {
      setFlagSubmitting(false);
    }
  };

  return (
    <div className="mt-3 border border-[var(--mod-border)] bg-[var(--mono-950)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--mono-white)]">Amend Evidence</span>
        <div className="flex items-center gap-2">
          <Toggle
            variant="mod"
            size="sm"
            pressed={flagged}
            onPressedChange={handleToggleFlag}
            disabled={flagSubmitting}
            aria-label="Toggle flag"
          >
            <IconFlag size={14} />
          </Toggle>
          <button onClick={onClose} className="text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]">
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger variant="mod" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent variant="mod">
            <SelectItem value="NOTE_ADDED" variant="mod">Add Note</SelectItem>
            <SelectItem value="DESCRIPTION_UPDATED" variant="mod">Update Description</SelectItem>
          </SelectContent>
        </Select>

        {action === 'DESCRIPTION_UPDATED' && (
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="New description..."
            className="w-full border border-[var(--mod-border)] bg-[var(--mono-900)] px-2 py-1 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
          />
        )}

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason..."
          rows={2}
          className="w-full border border-[var(--mod-border)] bg-[var(--mono-900)] px-2 py-1 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
        />

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="border border-[var(--mono-500)] px-3 py-1 text-xs text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] disabled:opacity-30"
        >
          {submitting ? 'Submitting...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function BulkNoteModal({
  count,
  onSubmit,
  onClose,
  submitting,
}: {
  count: number;
  onSubmit: (note: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-sm border border-[var(--mod-border)] bg-[var(--mono-900)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-medium text-[var(--mono-white)]">
          Add Note to {count} item{count !== 1 ? 's' : ''}
        </h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note..."
          rows={3}
          className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none focus:border-[var(--mono-500)]"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onSubmit(note)}
            disabled={submitting || !note.trim()}
            className="border border-[var(--mono-500)] px-4 py-1.5 text-xs text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] disabled:opacity-30"
          >
            {submitting ? 'Adding...' : 'Add Note'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
