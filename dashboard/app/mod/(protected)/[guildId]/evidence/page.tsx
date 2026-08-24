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
import { useTranslations } from "next-intl";

const PAGE_SIZE = 25;

export default function GuildEvidencePage() {
  const t = useTranslations("Moderation");
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

  const evidenceTypeLabel = (type: string) => {
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

  const evidenceStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return t("statusPending");
      case "PROCESSING": return t("statusProcessing");
      case "VERIFIED": return t("statusVerified");
      case "FLAGGED": return t("statusFlagged");
      case "REJECTED": return t("statusRejected");
      default: return status;
    }
  };

  const evidenceTypes = [
    { value: "", label: t("allTypes") },
    ...["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "URL", "DISCORD_URL", "MESSAGE_SNAPSHOT"]
      .map((value) => ({ value, label: evidenceTypeLabel(value) })),
  ];

  const evidenceStatuses = [
    { value: "", label: t("anyStatus") },
    ...["VERIFIED", "FLAGGED", "PENDING", "PROCESSING", "REJECTED"]
      .map((value) => ({ value, label: evidenceStatusLabel(value) })),
  ];

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
    <SectionGate section="evidence" label={t("evidenceBrowser")}>
      <div {...paginationSwipe}>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">
              {t("evidenceReview")}
            </h1>
            <p className="text-sm text-[var(--mod-text-muted)]">
              {t("evidenceReviewDescription")}
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--mod-text-dim)]">
            {t("itemCount", { count: total })}
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
              placeholder={t("searchEvidencePlaceholder")}
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
                <SelectValue placeholder={t("allTypes")} />
              </SelectTrigger>
              <SelectContent variant="mod">
                {evidenceTypes.map((type) => (
                  <SelectItem
                    key={type.value || "_all"}
                    value={type.value || "_all"}
                    variant="mod"
                  >
                    {type.label}
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
                <SelectValue placeholder={t("anyStatus")} />
              </SelectTrigger>
              <SelectContent variant="mod">
                {evidenceStatuses.map((status) => (
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
                {t("caseNumberShort")}
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
              placeholder={t("tagsCommaSeparated")}
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
                {t("clearFilters")}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--mod-text-dim)]">
            {t("loadingEvidence")}
          </div>
        ) : evidence.length === 0 ? (
          <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8 text-center text-[var(--mod-text-muted)]">
            {hasFilters
              ? t("noEvidenceMatchesFilters")
              : t("noEvidenceAcrossCases")}
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
                  {t("previous")}
                </button>
                <span className="text-xs text-[var(--mod-text-dim)]">
                  {t("pageOf", { page: pageParam, totalPages })}
                </span>
                <button
                  onClick={() => updateParams({ page: String(pageParam + 1) })}
                  disabled={pageParam >= totalPages}
                  className="border border-[var(--mod-border)] px-3 py-1.5 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
                >
                  {t("next")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SectionGate>
  );
}
