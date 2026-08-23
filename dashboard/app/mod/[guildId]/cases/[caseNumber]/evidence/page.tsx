'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { getEvidenceForCase } from '@/lib/services/mod.service';
import { EvidenceGallery } from '@/components/mod/evidence-gallery';
import { EvidenceWizard } from '@/components/mod/evidence-wizard';
import { SectionGate } from '@/components/mod/section-gate';

export default function EvidencePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const caseNumber = parseInt(params.caseNumber as string);

  const { data: evidenceData, isLoading: loading, mutate } = useSWR(
    ['case-evidence', guildId, caseNumber],
    () => getEvidenceForCase(guildId, caseNumber),
  );

  const evidence = evidenceData?.evidence ?? [];
  const summary = evidenceData?.summary ?? null;
  const refreshData = useCallback(() => { mutate(); }, [mutate]);

  return (
    <div>
      <Link href={`/mod/${guildId}/cases/${caseNumber}`} className="mb-4 inline-block text-xs text-[var(--mod-text-dim)] hover:text-[var(--mod-text-muted)]">
        ← Back to case
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-[var(--mono-white)]">
        Evidence — Case #{caseNumber}
      </h1>
      <p className="mb-6 text-sm text-[var(--mod-text-muted)]">
        {summary?.total ?? 0} evidence item(s)
        {summary?.totalSizeBytes ? ` · ${(summary.totalSizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
      </p>

      {summary?.hasWeakEvidenceOnly && (
        <div className="mb-4  border border-yellow-800 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-400">
          This case only has Discord message links. Consider adding stronger evidence.
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[var(--mod-text-dim)]">Loading evidence...</div>
      ) : (
        <EvidenceGallery evidence={evidence} guildId={guildId} />
      )}

      <SectionGate section="evidenceAdd" label="evidence uploads">
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-[var(--mono-white)]">Upload Evidence</h2>
          <EvidenceWizard guildId={guildId} caseNumber={caseNumber} onUploadComplete={refreshData} />
        </div>
      </SectionGate>
    </div>
  );
}
