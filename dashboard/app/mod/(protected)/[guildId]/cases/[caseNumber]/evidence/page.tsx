"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import useSWR from "swr";
import Link from "next/link";
import { getEvidenceForCase } from "@/lib/services/mod.service";
import { EvidenceGallery } from "@/components/mod/evidence-gallery";
import { EvidenceWizard } from "@/components/mod/evidence-wizard";
import { SectionGate } from "@/components/mod/section-gate";
import { IconSearch } from "@/lib/mod-icons";
import { useFormatter, useTranslations } from "next-intl";

export default function EvidencePage() {
  const t = useTranslations("Moderation");
  const format = useFormatter();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const guildId = params.guildId as string;
  const caseNumber = parseInt(params.caseNumber as string);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const query = searchParams.get("search") ?? "";
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setLocalQuery(query), 0);
    return () => window.clearTimeout(syncTimer);
  }, [query]);

  const updateLocation = useCallback(
    (updates: { page?: number; search?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.page && updates.page > 1)
        next.set("page", String(updates.page));
      else if ("page" in updates) next.delete("page");
      if (updates.search) next.set("search", updates.search);
      else if ("search" in updates) next.delete("search");
      if ("search" in updates) next.delete("page");
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const updateSearch = useDebouncedCallback((value: string) => {
    if (value.length === 0) updateLocation({ search: undefined });
    else if (value.length >= 2) updateLocation({ search: value });
  }, 300);

  const {
    data: evidenceData,
    isLoading: loading,
    mutate,
  } = useSWR(["case-evidence", guildId, caseNumber, query, page], () =>
    getEvidenceForCase(guildId, caseNumber, {
      page,
      limit: 50,
      ...(query && { search: query }),
    }),
  );

  const evidence = evidenceData?.evidence ?? [];
  const summary = evidenceData?.summary ?? null;
  const totalPages = evidenceData?.totalPages ?? 1;
  const refreshData = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div>
      <Link
        href={`/mod/${guildId}/cases/${caseNumber}`}
        className="mb-4 inline-block text-xs text-[var(--mod-text-dim)] hover:text-[var(--mod-text-muted)]"
      >
        ← {t("backToCase")}
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">
        {t("caseEvidenceTitle", { caseNumber })}
      </h1>
      <p className="mb-6 text-sm text-[var(--mod-text-muted)]">
        {t("evidenceItemCount", { count: summary?.total ?? 0 })}
        {summary?.totalSizeBytes
          ? ` · ${format.number(summary.totalSizeBytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`
          : ""}
      </p>

      {summary?.hasWeakEvidenceOnly && (
        <div className="mb-4  border border-yellow-800 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-400">
          {t("weakEvidenceShortWarning")}
        </div>
      )}

      <div className="relative mb-4 border border-[var(--mod-border)] bg-[var(--mono-950)]">
        <IconSearch
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mod-text-dim)]"
        />
        <input
          type="search"
          value={localQuery}
          onChange={(event) => {
            setLocalQuery(event.target.value);
            updateSearch(event.target.value.trim());
          }}
          placeholder={t("searchCaseEvidencePlaceholder")}
          className="h-11 w-full bg-transparent pl-11 pr-4 text-sm text-[var(--mono-white)] outline-none placeholder:text-[var(--mod-text-dim)]"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--mod-text-dim)]">
          {t("loadingEvidence")}
        </div>
      ) : (
        <>
          <EvidenceGallery
            evidence={evidence}
            guildId={guildId}
            mode="case"
            total={summary?.total}
            onEvidenceUpdated={refreshData}
          />
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border border-[var(--mod-border)] px-3 py-2 text-xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateLocation({ page: page - 1 })}
                className="text-[var(--mod-text-muted)] hover:text-[var(--mono-white)] disabled:opacity-25"
              >
                ← {t("newer")}
              </button>
              <span className="font-mono text-[var(--mod-text-dim)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => updateLocation({ page: page + 1 })}
                className="text-[var(--mod-text-muted)] hover:text-[var(--mono-white)] disabled:opacity-25"
              >
                {t("older")} →
              </button>
            </div>
          )}
        </>
      )}

      <SectionGate section="evidenceAdd" label={t("evidenceUploads")}>
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-[var(--mono-white)]">
            {t("uploadEvidence")}
          </h2>
          <EvidenceWizard
            guildId={guildId}
            caseNumber={caseNumber}
            onUploadComplete={refreshData}
          />
        </div>
      </SectionGate>
    </div>
  );
}
