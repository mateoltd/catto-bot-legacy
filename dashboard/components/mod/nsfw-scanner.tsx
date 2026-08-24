'use client';

import { useState } from 'react';
import type { NsfwResult } from '@/lib/nsfw';
import { useFormatter, useTranslations } from 'next-intl';

interface NsfwScannerProps {
  result: NsfwResult;
  filename: string;
  onConfirmSafe: () => void;
  onReject: () => void;
}

export function NsfwScanner({ result, filename, onConfirmSafe, onReject }: NsfwScannerProps) {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="border border-yellow-800 bg-yellow-950/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <h3 className="font-semibold text-yellow-400">{t('contentFlagged')}</h3>
      </div>

      <p className="mb-2 text-sm text-yellow-300">
        {t('nsfwFlaggedDescription', { filename, confidence: format.number(result.confidence, { style: 'percent', maximumFractionDigits: 1 }) })}
      </p>

      <div className="mb-3 bg-[var(--mono-950)] p-2 text-xs text-[var(--mod-text-dim)]">
        {Object.entries(result.categories)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, score]) => (
            <div key={cat} className="flex justify-between">
              <span>{cat}</span>
              <span>{format.number(score, { style: 'percent', maximumFractionDigits: 1 })}</span>
            </div>
          ))}
      </div>

      <p className="mb-4 text-xs text-[var(--mod-text-muted)]">
        {t('nsfwLegitimateDescription')}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--mod-text-muted)]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t('confirmLegitimateEvidence')}
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onConfirmSafe}
          disabled={!confirmed}
          className="border border-yellow-800 px-3 py-1 text-sm text-yellow-400 transition-[background-color] duration-75 hover:bg-yellow-950/40 disabled:opacity-30"
        >
          {t('proceedWithUpload')}
        </button>
        <button
          onClick={onReject}
          className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)]"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
