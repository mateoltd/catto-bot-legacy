"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  getCaseDetail,
  getEvidenceForCase,
  exportCase,
} from "@/lib/services/mod.service";
import { EvidenceGallery } from "@/components/mod/evidence-gallery";
import { EvidenceWizard } from "@/components/mod/evidence-wizard";
import { CaseNotes } from "@/components/mod/case-notes";
import { IconFileExport, IconLock } from "@/lib/mod-icons";
import { useFormatter, useTranslations } from "next-intl";

export default function CaseDetailPage() {
  const t = useTranslations("Moderation");
  const format = useFormatter();
  const params = useParams();
  const guildId = params.guildId as string;
  const caseNumber = parseInt(params.caseNumber as string);

  const actionLabel = (action: string) => {
    switch (action) {
      case "BAN": return t("actionBan");
      case "UNBAN": return t("actionUnban");
      case "KICK": return t("actionKick");
      case "TIMEOUT": return t("actionTimeout");
      case "WARN": return t("actionWarning");
      case "SOFTBAN": return t("actionSoftban");
      case "TEMPBAN": return t("actionTempban");
      case "MUTE_TEXT": return t("actionMuteText");
      case "MUTE_VOICE": return t("actionMuteVoice");
      case "MUTE_BOTH": return t("actionMute");
      case "UNMUTE_TEXT": return t("actionUnmuteText");
      case "UNMUTE_VOICE": return t("actionUnmuteVoice");
      case "UNMUTE_BOTH": return t("actionUnmute");
      default: return action;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "OPEN": return t("statusOpen");
      case "CLOSED": return t("statusClosed");
      case "VOID": return t("statusVoid");
      default: return status;
    }
  };
  const { data: modCase, isLoading: caseLoading } = useSWR(
    ["case-detail", guildId, caseNumber],
    () => getCaseDetail(guildId, caseNumber),
  );

  const {
    data: evidenceData,
    isLoading: evidenceLoading,
    mutate: mutateEvidence,
  } = useSWR(["case-evidence", guildId, caseNumber], () =>
    getEvidenceForCase(guildId, caseNumber),
  );

  const evidence = evidenceData?.evidence ?? [];
  const summary = evidenceData?.summary ?? null;
  const loading = caseLoading || evidenceLoading;

  const refreshEvidence = useCallback(() => {
    mutateEvidence();
  }, [mutateEvidence]);

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = await exportCase(guildId, caseNumber);
      window.open(result.downloadUrl, "_blank");
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }, [guildId, caseNumber]);

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--mod-text-dim)]">
        {t("loadingCase")}
      </div>
    );
  }

  if (!modCase) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--mod-text-muted)]">
          {t("caseNotFound", { caseNumber })}
        </p>
        <Link
          href={`/mod/${guildId}/cases`}
          className="mt-4 inline-block text-sm text-[var(--mod-text-dim)] underline"
        >
          {t("backToCases")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href={`/mod/${guildId}/cases`}
            className="mb-2 inline-block text-xs text-[var(--mod-text-dim)] hover:text-[var(--mod-text-muted)]"
          >
            ← {t("backToCases")}
          </Link>
          <h1 className="text-2xl font-bold text-[var(--mono-white)]">
            {t("caseTitle", { caseNumber: modCase.caseNumber })}
          </h1>
          <p className="text-sm text-[var(--mod-text-muted)]">
            {actionLabel(modCase.action)} —{" "}
            {modCase.targetTag}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 border border-[var(--mod-border)] px-3 py-1 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
          >
            <IconFileExport size={14} />
            {exporting ? t("exportingCase") : t("exportCase")}
          </button>
          <span
            className={`flex items-center gap-1.5 border px-3 py-1 text-xs ${
              modCase.status === "OPEN"
                ? "border-green-800 text-green-400"
                : modCase.status === "VOID"
                  ? "border-red-800 text-red-400"
                  : "border-[var(--mono-700)] text-[var(--mod-text-dim)]"
            }`}
          >
            {modCase.status === "CLOSED" && <IconLock size={12} />}
            {statusLabel(modCase.status)}
          </span>
        </div>
      </div>

      {/* Case Details */}
      <div className="mb-8 border border-[var(--mod-border)] bg-[var(--mod-surface)] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t("target")}
            </label>
            <p className="text-sm text-[var(--mono-white)]">
              <Link
                href={`/mod/${guildId}/users/${modCase.targetId}`}
                className="hover:underline"
              >
                {modCase.targetTag}
              </Link>{" "}
              <span className="text-[var(--mod-text-dim)]">
                ({modCase.targetId})
              </span>
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t("moderator")}
            </label>
            <p className="text-sm text-[var(--mono-white)]">
              <Link
                href={`/mod/${guildId}/users/${modCase.moderatorId}`}
                className="hover:underline"
              >
                {modCase.moderatorTag}
              </Link>{" "}
              <span className="text-[var(--mod-text-dim)]">
                ({modCase.moderatorId})
              </span>
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t("reason")}
            </label>
            <p className="text-sm text-[var(--mod-text)]">
              {modCase.reason ?? t("noReasonProvided")}
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
              {t("created")}
            </label>
            <p className="text-sm text-[var(--mod-text)]">
              {format.dateTime(new Date(modCase.createdAt), { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          {modCase.duration && (
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--mod-text-dim)]">
                {t("duration")}
              </label>
              <p className="text-sm text-[var(--mod-text)]">
                {t("durationSeconds", { seconds: modCase.duration })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Weak evidence warning */}
      {summary?.hasWeakEvidenceOnly && (
        <div className="mb-4  border border-yellow-800 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-400">
          {t("weakEvidenceWarning")}
        </div>
      )}

      {/* Evidence Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--mono-white)]">
          {t("evidenceWithCount", { count: summary?.total ?? 0 })}
        </h2>
        <Link
          href={`/mod/${guildId}/cases/${caseNumber}/evidence`}
          className="text-xs text-[var(--mod-text-dim)] underline hover:text-[var(--mod-text-muted)]"
        >
          {t("fullEvidenceView")} →
        </Link>
      </div>

      <EvidenceGallery
        evidence={evidence}
        guildId={guildId}
        mode="case"
        total={summary?.total}
        onEvidenceUpdated={refreshEvidence}
      />

      {/* Upload */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-[var(--mono-white)]">
          {t("addEvidence")}
        </h2>
        <EvidenceWizard
          guildId={guildId}
          caseNumber={caseNumber}
          onUploadComplete={refreshEvidence}
        />
      </div>

      {/* Discussion */}
      <div className="mt-8">
        <CaseNotes guildId={guildId} caseNumber={caseNumber} />
      </div>
    </div>
  );
}
