'use client';

import { useState } from 'react';
import type { NsfwResult } from '@/lib/nsfw';

interface NsfwScannerProps {
  result: NsfwResult;
  filename: string;
  onConfirmSafe: () => void;
  onReject: () => void;
}

export function NsfwScanner({ result, filename, onConfirmSafe, onReject }: NsfwScannerProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="border border-yellow-800 bg-yellow-950/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <h3 className="font-semibold text-yellow-400">Content Flagged</h3>
      </div>

      <p className="mb-2 text-sm text-yellow-300">
        The file <strong className="font-mono">{filename}</strong> was flagged by the NSFW scanner
        with {(result.confidence * 100).toFixed(1)}% confidence.
      </p>

      <div className="mb-3 bg-[var(--mono-950)] p-2 text-xs text-[var(--mod-text-dim)]">
        {Object.entries(result.categories)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, score]) => (
            <div key={cat} className="flex justify-between">
              <span>{cat}</span>
              <span>{(score * 100).toFixed(1)}%</span>
            </div>
          ))}
      </div>

      <p className="mb-4 text-xs text-[var(--mod-text-muted)]">
        If this is legitimate evidence (e.g., screenshots of rule-breaking content), you may
        confirm it is safe to upload. Illegal content must not be uploaded.
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--mod-text-muted)]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm this is legitimate moderation evidence
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onConfirmSafe}
          disabled={!confirmed}
          className="border border-yellow-800 px-3 py-1 text-sm text-yellow-400 transition-[background-color] duration-75 hover:bg-yellow-950/40 disabled:opacity-30"
        >
          Proceed with Upload
        </button>
        <button
          onClick={onReject}
          className="border border-[var(--mod-border)] px-3 py-1 text-sm text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
