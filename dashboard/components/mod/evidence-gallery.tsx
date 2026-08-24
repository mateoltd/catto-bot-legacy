"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import type { Evidence } from "@/lib/mod-types";
import { EVIDENCE_STATUS_META, EVIDENCE_TYPE_META } from "@/lib/mod-types";
import {
  EVIDENCE_TYPE_ICONS,
  IconCheck,
  IconCompare,
  IconDownload,
  IconEye,
  IconFile,
  IconFlag,
  IconHistory,
  IconNote,
  IconPencil,
  IconX,
} from "@/lib/mod-icons";
import {
  amendEvidence,
  getEvidenceDownloadUrl,
  getEvidenceViewUrl,
} from "@/lib/services/mod.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { EvidenceComparison } from "./evidence-comparison";
import { EvidenceHistory } from "./evidence-history";
import { EvidenceViewer } from "./evidence-viewer";
import { useFormatter, useTranslations } from "next-intl";

interface EvidenceGalleryProps {
  evidence: Evidence[];
  guildId: string;
  mode?: "corpus" | "case";
  total?: number;
  onEvidenceUpdated?: () => void;
}

const STATUS_DOT: Record<Evidence["status"], string> = {
  PENDING: "bg-yellow-400",
  PROCESSING: "bg-blue-400",
  VERIFIED: "bg-green-400",
  FLAGGED: "bg-red-400",
  REJECTED: "bg-red-700",
};

function evidenceName(item: Evidence) {
  return (
    item.originalFilename ??
    item.url ??
    item.description ??
    `Evidence ${item.id.slice(0, 8)}`
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Search results become case groups; a single case becomes a chronology. */
export function EvidenceGallery({
  evidence,
  guildId,
  mode = new Set(evidence.map((item) => item.caseNumber)).size > 1
    ? "corpus"
    : "case",
  total = evidence.length,
  onEvidenceUpdated,
}: EvidenceGalleryProps) {
  const t = useTranslations("Moderation");
  const format = useFormatter();
  const [activeId, setActiveId] = useState<string | null>(
    evidence[0]?.id ?? null,
  );
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [amendingId, setAmendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const resolvedActiveId =
    activeId && evidence.some((item) => item.id === activeId)
      ? activeId
      : (evidence[0]?.id ?? null);
  const activeItem =
    evidence.find((item) => item.id === resolvedActiveId) ?? evidence[0];
  const hasSelection = selectedIds.size > 0;
  const canCompare = selectedIds.size === 2;
  const caseCount = new Set(evidence.map((item) => item.caseNumber)).size;
  const statusCounts = useMemo(
    () =>
      evidence.reduce<Partial<Record<Evidence["status"], number>>>(
        (counts, item) => {
          counts[item.status] = (counts[item.status] ?? 0) + 1;
          return counts;
        },
        {},
      ),
    [evidence],
  );
  const allSelectedFlagged =
    hasSelection &&
    [...selectedIds].every(
      (id) => evidence.find((item) => item.id === id)?.status === "FLAGGED",
    );

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return t("statusPending");
      case "PROCESSING": return t("statusProcessing");
      case "VERIFIED": return t("statusVerified");
      case "FLAGGED": return t("statusFlagged");
      case "REJECTED": return t("statusRejected");
      default: return status;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "IMAGE": return t("evidenceImage");
      case "VIDEO": return t("evidenceVideo");
      case "AUDIO": return t("evidenceAudio");
      case "DOCUMENT": return t("evidenceDocument");
      case "URL": return t("evidenceUrl");
      case "DISCORD_URL": return t("evidenceDiscordLink");
      case "MESSAGE_SNAPSHOT": return t("evidenceSnapshot");
      default: return type;
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = async (item: Evidence) => {
    try {
      const url = await getEvidenceDownloadUrl(guildId, item.id);
      if (url) window.open(url, "_blank");
    } catch {
      // Keep the review workspace usable if a signed URL cannot be created.
    }
  };

  const handleBulkFlag = async (flag: boolean) => {
    setBulkSubmitting(true);
    try {
      for (const id of selectedIds) {
        await amendEvidence(guildId, id, {
          action: flag ? "FLAGGED" : "UNFLAGGED",
          reason: flag ? "Bulk flagged" : "Bulk unflagged",
        });
      }
      onEvidenceUpdated?.();
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDownload = async () => {
    for (const id of selectedIds) {
      const item = evidence.find((candidate) => candidate.id === id);
      if (item?.storageKey) await handleDownload(item);
    }
  };

  const handleBulkNote = async (note: string) => {
    setBulkSubmitting(true);
    try {
      for (const id of selectedIds) {
        await amendEvidence(guildId, id, {
          action: "NOTE_ADDED",
          reason: note,
        });
      }
      setSelectedIds(new Set());
      setBulkAction(null);
      onEvidenceUpdated?.();
    } finally {
      setBulkSubmitting(false);
    }
  };

  const comparisonItems = useMemo(() => {
    if (!canCompare) return null;
    const items = [...selectedIds]
      .map((id) => evidence.find((item) => item.id === id))
      .filter(Boolean);
    return items.length === 2 ? (items as [Evidence, Evidence]) : null;
  }, [canCompare, evidence, selectedIds]);

  if (!activeItem) {
    return (
      <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-sm text-[var(--mod-text-muted)]">
        {t("noEvidenceAdded")}
      </div>
    );
  }

  const TypeIcon = EVIDENCE_TYPE_ICONS[activeItem.type];
  const typeMeta = EVIDENCE_TYPE_META[activeItem.type];
  const statusMeta = EVIDENCE_STATUS_META[activeItem.status];
  const viewerItem = evidence.find((item) => item.id === viewerId);

  return (
    <>
      <section
        aria-label={t("evidenceReviewWorkspace")}
        className="overflow-hidden border border-[var(--mod-border)] bg-[var(--mod-surface)]"
      >
        {mode === "corpus" && (
          <header className="flex flex-col gap-3 border-b border-[var(--mod-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--mod-text-dim)]">
              <span className="font-medium text-[var(--mod-text)]">
                {t("showingItems", { shown: evidence.length, total: format.number(total) })}
              </span>
              <span>{t("acrossCaseGroups", { count: caseCount })}</span>
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 ${STATUS_DOT[status as Evidence["status"]]}`}
                  />
                  {t("statusItemCount", { count, status: statusLabel(status) })}
                </span>
              ))}
            </div>
            <span className="text-xs text-[var(--mod-text-dim)]">
              {t("resultsGroupedByCase")}
            </span>
          </header>
        )}

        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <EvidenceIndex
            evidence={evidence}
            guildId={guildId}
            activeId={activeItem.id}
            selectedIds={selectedIds}
            mode={mode}
            onActivate={setActiveId}
          />

          <div className="grid min-h-[430px] xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col border-b border-[var(--mod-border)] lg:border-b-0 lg:border-r">
              <div className="flex flex-col gap-3 border-b border-[var(--mod-border)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <TypeIcon size={16} className={typeMeta.className} />
                    <span className="text-[var(--mod-text-muted)]">
                      {typeLabel(activeItem.type)}
                    </span>
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] ${statusMeta.className}`}
                    >
                      {statusLabel(activeItem.status)}
                    </span>
                    <Link
                      href={`/mod/${guildId}/cases/${activeItem.caseNumber}`}
                      className="text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
                    >
                      {t("caseTitle", { caseNumber: activeItem.caseNumber })}
                    </Link>
                  </div>
                  <h3 className="truncate text-base font-medium text-[var(--mono-white)]">
                    {evidenceName(activeItem)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSelection(activeItem.id)}
                  aria-label={t("selectEvidence", { name: evidenceName(activeItem) })}
                  className={`flex shrink-0 items-center gap-2 border px-2.5 py-1.5 text-xs ${
                    selectedIds.has(activeItem.id)
                      ? "border-[var(--mono-400)] bg-[var(--mono-700)] text-[var(--mono-white)]"
                      : "border-[var(--mod-border)] text-[var(--mod-text-muted)] hover:bg-[var(--mod-surface-hover)]"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center border border-current">
                    {selectedIds.has(activeItem.id) && <IconCheck size={11} />}
                  </span>
                  {selectedIds.has(activeItem.id) ? t("selected") : t("select")}
                </button>
              </div>

              <EvidenceFocusPreview evidence={activeItem} guildId={guildId} />

              <div className="flex flex-wrap border-t border-[var(--mod-border)] bg-[var(--mono-950)]">
                {(activeItem.storageKey ||
                  activeItem.url ||
                  activeItem.snapshotId) && (
                  <ActionButton
                    icon={<IconEye size={15} />}
                    onClick={() => setViewerId(activeItem.id)}
                  >
                    {t("inspect")}
                  </ActionButton>
                )}
                {activeItem.storageKey && (
                  <ActionButton
                    icon={<IconDownload size={15} />}
                    onClick={() => handleDownload(activeItem)}
                  >
                    {t("download")}
                  </ActionButton>
                )}
                <ActionButton
                  icon={<IconHistory size={15} />}
                  onClick={() => setHistoryId(activeItem.id)}
                >
                  {t("history")}
                </ActionButton>
                <ActionButton
                  icon={<IconPencil size={15} />}
                  onClick={() =>
                    setAmendingId(
                      amendingId === activeItem.id ? null : activeItem.id,
                    )
                  }
                >
                  {t("amend")}
                </ActionButton>
              </div>
            </div>

            <aside className="bg-[var(--mono-950)]">
              <DossierRow
                label={t("added")}
                value={format.dateTime(new Date(activeItem.createdAt), { dateStyle: "medium", timeStyle: "short" })}
              />
              <DossierRow
                label={t("submittedBy")}
                value={activeItem.uploadedByTag}
              />
              {formatBytes(activeItem.sizeBytes) && (
                <DossierRow
                  label={t("fileSize")}
                  value={formatBytes(activeItem.sizeBytes)!}
                />
              )}
              {activeItem.mimeType && (
                <DossierRow label={t("format")} value={activeItem.mimeType} />
              )}

              <div className="border-b border-[var(--mod-border)] p-4">
                <p className="mb-2 text-xs text-[var(--mod-text-dim)]">
                  {t("description")}
                </p>
                <p className="text-sm leading-5 text-[var(--mod-text)]">
                  {activeItem.description || t("noDescriptionAdded")}
                </p>
              </div>

              {activeItem.tags.length > 0 && (
                <div className="border-b border-[var(--mod-border)] p-4">
                  <p className="mb-2 text-xs text-[var(--mod-text-dim)]">
                    {t("tags")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeItem.tags.map((tag) => (
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

              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--mod-text-dim)]">
                  {t("integrity")}
                  </span>
                  <span
                    className={
                      activeItem.contentHash
                        ? "text-xs text-green-400"
                        : "text-xs text-[var(--mod-text-dim)]"
                    }
                  >
                    {activeItem.contentHash ? t("hashRecorded") : t("noFileHash")}
                  </span>
                </div>
                {activeItem.contentHash && (
                  <code className="mt-2 block truncate text-[10px] text-[var(--mod-text-dim)]">
                    {activeItem.contentHash}
                  </code>
                )}
              </div>
            </aside>
          </div>
        </div>

        {amendingId === activeItem.id && (
          <div className="border-t border-[var(--mod-border)] p-4">
            <InlineAmendForm
              guildId={guildId}
              evidenceId={activeItem.id}
              isFlagged={activeItem.status === "FLAGGED"}
              onClose={() => setAmendingId(null)}
              onAmended={() => {
                setAmendingId(null);
                onEvidenceUpdated?.();
              }}
              onEvidenceUpdated={onEvidenceUpdated}
            />
          </div>
        )}
      </section>

      {hasSelection && (
        <div className="fixed inset-x-3 bottom-3 z-40 border border-[var(--mono-500)] bg-[var(--mono-900)] p-2 shadow-2xl sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 text-xs text-[var(--mod-text-muted)]">
              {t("selectedCount", { count: selectedIds.size })}
            </span>
            {canCompare && (
              <ActionButton
                icon={<IconCompare size={14} />}
                onClick={() => setShowComparison(true)}
              >
                {t("compare")}
              </ActionButton>
            )}
            <Toggle
              variant="mod"
              size="sm"
              pressed={allSelectedFlagged}
              onPressedChange={handleBulkFlag}
              disabled={bulkSubmitting}
              className="flex h-8 items-center gap-1.5 px-2.5"
              aria-label={t("flagSelected")}
            >
              <IconFlag size={14} />
              {allSelectedFlagged ? t("unflag") : t("flag")}
            </Toggle>
            <ActionButton
              icon={<IconDownload size={14} />}
              onClick={handleBulkDownload}
            >
              {t("download")}
            </ActionButton>
            <ActionButton
              icon={<IconNote size={14} />}
              onClick={() => setBulkAction("note")}
            >
              {t("note")}
            </ActionButton>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-2 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
              aria-label={t("clearSelection")}
            >
              <IconX size={14} />
            </button>
          </div>
        </div>
      )}

      {bulkAction === "note" && (
        <BulkNoteModal
          count={selectedIds.size}
          onSubmit={handleBulkNote}
          onClose={() => setBulkAction(null)}
          submitting={bulkSubmitting}
        />
      )}

      {viewerItem && (
        <EvidenceViewer
          guildId={guildId}
          evidenceId={viewerItem.id}
          caseNumber={viewerItem.caseNumber}
          evidence={viewerItem}
          onClose={() => setViewerId(null)}
          onDownload={
            viewerItem.storageKey ? () => handleDownload(viewerItem) : undefined
          }
          onPrev={() => {
            const index = evidence.findIndex(
              (item) => item.id === viewerItem.id,
            );
            if (index > 0) setViewerId(evidence[index - 1].id);
          }}
          onNext={() => {
            const index = evidence.findIndex(
              (item) => item.id === viewerItem.id,
            );
            if (index < evidence.length - 1)
              setViewerId(evidence[index + 1].id);
          }}
        />
      )}

      {historyId && (
        <EvidenceHistory
          guildId={guildId}
          evidenceId={historyId}
          onClose={() => setHistoryId(null)}
        />
      )}

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

function EvidenceIndex({
  evidence,
  guildId,
  activeId,
  selectedIds,
  mode,
  onActivate,
}: {
  evidence: Evidence[];
  guildId: string;
  activeId: string;
  selectedIds: Set<string>;
  mode: "corpus" | "case";
  onActivate: (id: string) => void;
}) {
  const t = useTranslations("Moderation");
  const format = useFormatter();

  const typeLabel = (type: string) => {
    switch (type) {
      case "IMAGE": return t("evidenceImage");
      case "VIDEO": return t("evidenceVideo");
      case "AUDIO": return t("evidenceAudio");
      case "DOCUMENT": return t("evidenceDocument");
      case "URL": return t("evidenceUrl");
      case "DISCORD_URL": return t("evidenceDiscordLink");
      case "MESSAGE_SNAPSHOT": return t("evidenceSnapshot");
      default: return type;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return t("statusPending");
      case "PROCESSING": return t("statusProcessing");
      case "VERIFIED": return t("statusVerified");
      case "FLAGGED": return t("statusFlagged");
      case "REJECTED": return t("statusRejected");
      default: return status;
    }
  };
  const groups = useMemo(() => {
    const byCase = new Map<number, Evidence[]>();
    for (const item of evidence) {
      const group = byCase.get(item.caseNumber) ?? [];
      group.push(item);
      byCase.set(item.caseNumber, group);
    }
    return [...byCase.entries()];
  }, [evidence]);

  if (mode === "case") {
    const [caseNumber, caseEvidence] = groups[0];
    const chronology = [...caseEvidence].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const days = chronology.reduce<Map<string, Evidence[]>>((result, item) => {
      const day = format.dateTime(new Date(item.createdAt), { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      const items = result.get(day) ?? [];
      items.push(item);
      result.set(day, items);
      return result;
    }, new Map());

    return (
      <nav
        aria-label={t("evidenceRegisterForCase", { caseNumber })}
        className="max-h-[320px] overflow-y-auto border-b border-[var(--mod-border)] bg-[var(--mono-950)] lg:max-h-[720px] lg:border-b-0 lg:border-r"
      >
        {[...days.entries()].map(([day, items]) => (
          <section key={day}>
            <div className="border-b border-[var(--mod-border)] bg-[var(--mono-900)] px-4 py-2 text-xs text-[var(--mod-text-muted)]">
              {day}
            </div>
            {items.map((item) => {
              const ItemIcon = EVIDENCE_TYPE_ICONS[item.type];
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onActivate(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`group relative flex w-full items-start gap-3 border-b border-[var(--mod-border)] py-3 pl-5 pr-4 text-left ${
                    isActive
                      ? "bg-[var(--mono-800)] text-[var(--mono-white)]"
                      : "text-[var(--mod-text-muted)] hover:bg-[var(--mod-surface-hover)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-0.5 ${STATUS_DOT[item.status]}`}
                  />
                  <ItemIcon
                    size={15}
                    className={`mt-0.5 shrink-0 ${EVIDENCE_TYPE_META[item.type].className}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {evidenceName(item)}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--mod-text-dim)]">
                      <span>{typeLabel(item.type)}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.createdAt}>
                        {format.dateTime(new Date(item.createdAt), { hour: "2-digit", minute: "2-digit" })}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>{statusLabel(item.status)}</span>
                    </span>
                  </span>
                  {selectedIds.has(item.id) && (
                    <IconCheck size={13} className="mt-0.5 shrink-0" />
                  )}
                </button>
              );
            })}
          </section>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("evidenceResultsGroupedByCase")}
      className="max-h-[360px] overflow-y-auto border-b border-[var(--mod-border)] bg-[var(--mono-950)] lg:max-h-[720px] lg:border-b-0 lg:border-r"
    >
      <div className="sticky top-0 z-10 border-b border-[var(--mod-border)] bg-[var(--mono-950)] px-4 py-3 text-xs text-[var(--mod-text-dim)]">
        {t("caseGroupsOnPage", { count: groups.length })}
      </div>
      {groups.map(([caseNumber, items]) => (
        <section
          key={caseNumber}
          className="border-b border-[var(--mod-border)]"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Link
              href={`/mod/${guildId}/cases/${caseNumber}`}
              className="font-mono text-xs font-medium text-[var(--mono-white)] hover:underline"
            >
              {t("caseTitle", { caseNumber })}
            </Link>
            <span className="text-[10px] text-[var(--mod-text-dim)]">
              {t("matchCount", { count: items.length })}
            </span>
          </div>
          {items.map((item) => {
            const ItemIcon = EVIDENCE_TYPE_ICONS[item.type];
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onActivate(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full items-center gap-3 border-t border-[var(--mod-border)] px-4 py-2.5 text-left ${
                  isActive
                    ? "bg-[var(--mono-800)] text-[var(--mono-white)]"
                    : "text-[var(--mod-text-muted)] hover:bg-[var(--mod-surface-hover)]"
                }`}
              >
                <ItemIcon
                  size={15}
                  className={EVIDENCE_TYPE_META[item.type].className}
                />
                <span className="min-w-0 flex-1 truncate text-xs">
                  {evidenceName(item)}
                </span>
                <span
                  className={`h-1.5 w-1.5 shrink-0 ${STATUS_DOT[item.status]}`}
                />
                {selectedIds.has(item.id) && <IconCheck size={12} />}
              </button>
            );
          })}
        </section>
      ))}
    </nav>
  );
}

function EvidenceFocusPreview({
  evidence,
  guildId,
}: {
  evidence: Evidence;
  guildId: string;
}) {
  const t = useTranslations("Moderation");
  const format = useFormatter();
  const needsViewUrl = Boolean(
    evidence.storageKey &&
    evidence.type !== "URL" &&
    evidence.type !== "DISCORD_URL" &&
    evidence.type !== "MESSAGE_SNAPSHOT",
  );
  const { data: viewUrl, isLoading } = useSWR(
    needsViewUrl ? ["evidence-focus-preview", guildId, evidence.id] : null,
    () => getEvidenceViewUrl(guildId, evidence.id),
  );

  if (evidence.type === "URL" || evidence.type === "DISCORD_URL") {
    const og = (evidence.metadata?.og ?? null) as {
      title?: string;
      description?: string;
      image?: string;
      siteName?: string;
    } | null;
    return (
      <div className="flex min-h-[310px] flex-1 items-center justify-center p-6">
        <a
          href={evidence.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="grid w-full max-w-2xl border border-[var(--mod-border)] bg-[var(--mono-900)] sm:grid-cols-[180px_1fr]"
        >
          <div className="flex min-h-36 items-center justify-center overflow-hidden border-b border-[var(--mod-border)] bg-[var(--mono-950)] sm:border-b-0 sm:border-r">
            {og?.image ? (
              // OG images are remote sources outside the dashboard image pipeline.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={og.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <EVIDENCE_TYPE_ICONS.URL
                size={32}
                className="text-[var(--mod-text-dim)]"
              />
            )}
          </div>
          <div className="min-w-0 p-5">
            {og?.siteName && (
              <p className="mb-2 text-xs text-[var(--mod-text-dim)]">
                {og.siteName}
              </p>
            )}
            <p className="text-base font-medium text-[var(--mono-white)]">
              {og?.title ?? evidence.url}
            </p>
            {og?.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-[var(--mod-text-muted)]">
                {og.description}
              </p>
            )}
            <p className="mt-4 truncate text-xs text-[var(--mod-text-dim)]">
              {evidence.url}
            </p>
          </div>
        </a>
      </div>
    );
  }

  if (evidence.type === "MESSAGE_SNAPSHOT") {
    const messages = evidence.snapshot?.snapshotData ?? [];
    return (
      <div className="flex min-h-[310px] flex-1 items-center justify-center p-6">
        <div className="w-full max-w-2xl border border-[var(--mod-border)] bg-[var(--mono-950)]">
          {messages.length ? (
            messages.slice(0, 3).map((message) => (
              <div
                key={message.messageId}
                className="border-b border-[var(--mod-border)] p-4 last:border-b-0"
              >
                <div className="mb-1 flex items-center justify-between gap-4">
                  <span className="text-xs font-medium text-[var(--mono-white)]">
                    {message.authorTag}
                  </span>
                  <span className="text-[10px] text-[var(--mod-text-dim)]">
                    {format.dateTime(new Date(message.createdAt), { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-[var(--mod-text-muted)]">
                  {message.content || t("attachment")}
                </p>
              </div>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-[var(--mod-text-dim)]">
              Snapshot preview unavailable.
            </p>
          )}
          {messages.length > 3 && (
            <p className="border-t border-[var(--mod-border)] px-4 py-2 text-xs text-[var(--mod-text-dim)]">
              +{messages.length - 3} more messages
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[310px] flex-1 items-center justify-center text-sm text-[var(--mod-text-dim)]">
        {t("preparingPreview")}
      </div>
    );
  }
  if (evidence.type === "IMAGE" && viewUrl) {
    return (
      <div className="flex min-h-[310px] flex-1 items-center justify-center overflow-hidden bg-[var(--mono-950)] p-4">
        {/* Signed evidence URLs are short-lived and should not enter Next's image cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={viewUrl}
          alt={evidence.originalFilename ?? t("evidenceImage")}
          className="max-h-[430px] max-w-full object-contain"
        />
      </div>
    );
  }
  if (evidence.type === "VIDEO" && viewUrl) {
    return (
      <div className="flex min-h-[310px] flex-1 items-center justify-center bg-black p-4">
        <video
          src={viewUrl}
          controls
          preload="metadata"
          className="max-h-[430px] max-w-full"
        />
      </div>
    );
  }
  if (evidence.type === "AUDIO" && viewUrl) {
    return (
      <div className="flex min-h-[310px] flex-1 items-center justify-center p-6">
        <audio src={viewUrl} controls className="w-full max-w-xl" />
      </div>
    );
  }

  const PreviewIcon = EVIDENCE_TYPE_ICONS[evidence.type] ?? IconFile;
  return (
    <div className="flex min-h-[310px] flex-1 flex-col items-center justify-center gap-3 bg-[var(--mono-950)] p-8 text-center">
      <PreviewIcon size={40} className="text-[var(--mod-text-dim)]" />
      <p className="max-w-md text-sm text-[var(--mod-text-muted)]">
        {evidence.type === "DOCUMENT"
          ? t("openInspectorForDocument")
          : t("noInlinePreview")}
      </p>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center gap-2 border-r border-[var(--mod-border)] px-3 text-xs text-[var(--mod-text-muted)] hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
    >
      {icon}
      {children}
    </button>
  );
}

function DossierRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 border-b border-[var(--mod-border)] px-4 py-3 text-xs">
      <span className="text-[var(--mod-text-dim)]">{label}</span>
      <span className="min-w-0 break-words text-right text-[var(--mod-text)]">
        {value}
      </span>
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
  const t = useTranslations("Moderation");
  const [action, setAction] = useState("NOTE_ADDED");
  const [reason, setReason] = useState("");
  const [newValue, setNewValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flagged, setFlagged] = useState(isFlagged);
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await amendEvidence(guildId, evidenceId, {
        action,
        newValue: newValue.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      onAmended();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFlag = async (pressed: boolean) => {
    setFlagSubmitting(true);
    try {
      await amendEvidence(guildId, evidenceId, {
        action: pressed ? "FLAGGED" : "UNFLAGGED",
        reason: pressed ? "Flagged" : "Unflagged",
      });
      setFlagged(pressed);
      onEvidenceUpdated?.();
    } finally {
      setFlagSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--mono-white)]">
            {t("amendEvidence")}
          </span>
          <Toggle
            variant="mod"
            size="sm"
            pressed={flagged}
            onPressedChange={handleToggleFlag}
            disabled={flagSubmitting}
            aria-label={t("toggleFlag")}
          >
            <IconFlag size={14} /> {flagged ? t("statusFlagged") : t("flag")}
          </Toggle>
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger variant="mod" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent variant="mod">
            <SelectItem value="NOTE_ADDED" variant="mod">
              {t("addNote")}
            </SelectItem>
            <SelectItem value="DESCRIPTION_UPDATED" variant="mod">
              {t("updateDescription")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        {action === "DESCRIPTION_UPDATED" && (
          <input
            type="text"
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder={t("newDescriptionPlaceholder")}
            className="mb-2 w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-xs text-[var(--mono-white)] outline-none"
          />
        )}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("reasonPlaceholder")}
          rows={2}
          className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-xs text-[var(--mono-white)] outline-none"
        />
      </div>
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="border border-[var(--mono-500)] px-3 py-2 text-xs text-[var(--mono-white)] hover:bg-[var(--mono-800)] disabled:opacity-30"
        >
          {submitting ? t("saving") : t("confirm")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-xs text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
        >
          {t("cancel")}
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
  const t = useTranslations("Moderation");
  const [note, setNote] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm border border-[var(--mod-border)] bg-[var(--mono-900)] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-medium text-[var(--mono-white)]">
          {t("addNoteToItems", { count })}
        </h3>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          rows={3}
          className="w-full border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onSubmit(note)}
            disabled={submitting || !note.trim()}
            className="border border-[var(--mono-500)] px-4 py-1.5 text-xs text-[var(--mono-white)] hover:bg-[var(--mono-800)] disabled:opacity-30"
          >
            {submitting ? t("adding") : t("addNote")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
