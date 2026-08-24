"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import useSWR from "swr";
import { getGuildEvidence } from "@/lib/services/mod.service";
import { EvidenceGallery } from "@/components/mod/evidence-gallery";
import { SectionGate } from "@/components/mod/section-gate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaginationNav } from "@/hooks/use-pagination-nav";
import { IconSearch } from "@/lib/mod-icons";

const EVIDENCE_TYPES: { value: string; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video" },
  { value: "AUDIO", label: "Audio" },
  { value: "DOCUMENT", label: "Document" },
  { value: "URL", label: "URL" },
  { value: "DISCORD_URL", label: "Discord Link" },
  { value: "MESSAGE_SNAPSHOT", label: "Snapshot" },
];

const EVIDENCE_STATUSES = [
  { value: "", label: "Any status" },
  { value: "VERIFIED", label: "Verified" },
  { value: "FLAGGED", label: "Flagged" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "REJECTED", label: "Rejected" },
];

const PAGE_SIZE = 25;

export default function GuildEvidencePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const typeParam = searchParams.get("type") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const caseParam = searchParams.get("case") ?? "";
  const queryParam = searchParams.get("search") ?? "";
  const tagsParam = searchParams.get("tags") ?? "";
  const pageParam = parseInt(searchParams.get("page") ?? "1") || 1;

  // Local state for immediate input feedback
  const [localCase, setLocalCase] = useState(caseParam);
  const [localQuery, setLocalQuery] = useState(queryParam);
  const [localTags, setLocalTags] = useState(tagsParam);

  // Sync local state when URL params change externally
  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setLocalCase(caseParam);
      setLocalQuery(queryParam);
      setLocalTags(tagsParam);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [caseParam, queryParam, tagsParam]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      // Reset to page 1 when filters change (unless we're explicitly setting page)
      if (!("page" in updates)) {
        next.delete("page");
      }
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  // Debounced URL update for case input
  const debouncedUpdateCase = useDebouncedCallback((value: string) => {
    updateParams({ case: value || undefined });
  }, 300);

  const debouncedUpdateQuery = useDebouncedCallback((value: string) => {
    if (value.length === 0) updateParams({ search: undefined });
    else if (value.length >= 2) updateParams({ search: value });
  }, 300);

  const debouncedUpdateTags = useDebouncedCallback((value: string) => {
    updateParams({ tags: value || undefined });
  }, 300);

  const handleCaseChange = useCallback(
    (value: string) => {
      setLocalCase(value);
      debouncedUpdateCase(value);
    },
    [debouncedUpdateCase],
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      debouncedUpdateQuery(value.trim());
    },
    [debouncedUpdateQuery],
  );

  const handleTagsChange = useCallback(
    (value: string) => {
      setLocalTags(value);
      debouncedUpdateTags(value.trim());
    },
    [debouncedUpdateTags],
  );

  const {
    data: evidenceData,
    isLoading: loading,
    mutate,
  } = useSWR(
    [
      "guild-evidence",
      guildId,
      queryParam,
      typeParam,
      statusParam,
      caseParam,
      tagsParam,
      pageParam,
    ],
    () =>
      getGuildEvidence(guildId, {
        page: pageParam,
        limit: PAGE_SIZE,
        ...(queryParam && { search: queryParam }),
        ...(typeParam && { type: typeParam }),
        ...(statusParam && { status: statusParam }),
        ...(caseParam && { case: parseInt(caseParam) }),
        ...(tagsParam && { tags: tagsParam }),
      }),
    { keepPreviousData: true },
  );

  const evidence = evidenceData?.evidence ?? [];
  const total = evidenceData?.total ?? 0;
  const totalPages = evidenceData?.totalPages ?? 1;
  const hasFilters = Boolean(
    queryParam || typeParam || statusParam || caseParam || tagsParam,
  );
  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const paginationSwipe = usePaginationNav({
    onPrev:
      pageParam > 1
        ? () => updateParams({ page: String(pageParam - 1) })
        : undefined,
    onNext:
      pageParam < totalPages
        ? () => updateParams({ page: String(pageParam + 1) })
        : undefined,
  });

  return (
    <SectionGate section="evidence" label="the evidence browser">
      <div {...paginationSwipe}>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">
              Evidence review
            </h1>
            <p className="text-sm text-[var(--mod-text-muted)]">
              Inspect source material, provenance and integrity without losing
              case context.
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--mod-text-dim)]">
            {total} item{total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Search and server-side facets */}
        <div className="mb-4 border border-[var(--mod-border)] bg-[var(--mod-surface)]">
          <div className="relative border-b border-[var(--mod-border)]">
            <IconSearch
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mod-text-dim)]"
            />
            <input
              type="search"
              value={localQuery}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search filenames, descriptions, links or submitters…"
              className="h-12 w-full bg-[var(--mono-950)] pl-11 pr-4 text-sm text-[var(--mono-white)] outline-none placeholder:text-[var(--mod-text-dim)]"
            />
          </div>
          <div className="flex flex-wrap items-center">
            {/* Type filter */}
            <Select
              value={typeParam || "_all"}
              onValueChange={(value) =>
                updateParams({ type: value === "_all" ? undefined : value })
              }
            >
              <SelectTrigger
                variant="mod"
                className="h-10 w-[160px] border-0 border-r border-[var(--mod-border)]"
              >
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent variant="mod">
                {EVIDENCE_TYPES.map((t) => (
                  <SelectItem
                    key={t.value || "_all"}
                    value={t.value || "_all"}
                    variant="mod"
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusParam || "_all"}
              onValueChange={(value) =>
                updateParams({ status: value === "_all" ? undefined : value })
              }
            >
              <SelectTrigger
                variant="mod"
                className="h-10 w-[150px] border-0 border-r border-[var(--mod-border)]"
              >
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent variant="mod">
                {EVIDENCE_STATUSES.map((status) => (
                  <SelectItem
                    key={status.value || "_all"}
                    value={status.value || "_all"}
                    variant="mod"
                  >
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Case number input */}
            <div className="flex h-10 items-center border-r border-[var(--mod-border)]">
              <label className="pl-3 text-xs text-[var(--mod-text-dim)]">
                Case #
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={localCase}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  handleCaseChange(val);
                }}
                placeholder="..."
                className="h-full w-20 bg-transparent px-2.5 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
              />
            </div>
            <input
              type="text"
              value={localTags}
              onChange={(event) => handleTagsChange(event.target.value)}
              placeholder="Tags, comma separated"
              className="h-10 min-w-48 flex-1 border-r border-[var(--mod-border)] bg-transparent px-3 text-xs text-[var(--mono-white)] outline-none placeholder:text-[var(--mod-text-dim)]"
            />
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setLocalQuery("");
                  setLocalCase("");
                  setLocalTags("");
                  updateParams({
                    search: undefined,
                    type: undefined,
                    status: undefined,
                    case: undefined,
                    tags: undefined,
                  });
                }}
                className="h-10 px-3 text-xs text-[var(--mod-text-dim)] hover:bg-[var(--mod-surface-hover)] hover:text-[var(--mono-white)]"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--mod-text-dim)]">
            Loading evidence...
          </div>
        ) : evidence.length === 0 ? (
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-[var(--mod-text-muted)]">
            {hasFilters
              ? "No evidence matches the current filters."
              : "No evidence found across any cases."}
          </div>
        ) : (
          <>
            <EvidenceGallery
              evidence={evidence}
              guildId={guildId}
              mode="corpus"
              total={total}
              onEvidenceUpdated={handleRefresh}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => updateParams({ page: String(pageParam - 1) })}
                  disabled={pageParam <= 1}
                  className="border border-[var(--mod-border)] px-3 py-1.5 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-xs text-[var(--mod-text-dim)]">
                  Page {pageParam} of {totalPages}
                </span>
                <button
                  onClick={() => updateParams({ page: String(pageParam + 1) })}
                  disabled={pageParam >= totalPages}
                  className="border border-[var(--mod-border)] px-3 py-1.5 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SectionGate>
  );
}
