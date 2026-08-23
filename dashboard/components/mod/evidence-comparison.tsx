'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { Evidence } from '@/lib/mod-types';
import { EVIDENCE_TYPE_META } from '@/lib/mod-types';
import { getEvidenceViewUrl } from '@/lib/services/mod.service';
import { IconX, IconColumns, IconRows } from '@/lib/mod-icons';
import { useEscapeClose } from '@/hooks/use-escape-close';

interface EvidenceComparisonProps {
  guildId: string;
  items: [Evidence, Evidence];
  onClose: () => void;
}

type ViewMode = 'split' | 'toggle';

export function EvidenceComparison({ guildId, items, onClose }: EvidenceComparisonProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [activeIndex, setActiveIndex] = useState(0);

  useEscapeClose(onClose);

  // Fetch URLs for both items
  const { data: url1 } = useSWR(
    items[0].storageKey ? ['evidence-url', guildId, items[0].id] : null,
    () => getEvidenceViewUrl(guildId, items[0].id)
  );
  const { data: url2 } = useSWR(
    items[1].storageKey ? ['evidence-url', guildId, items[1].id] : null,
    () => getEvidenceViewUrl(guildId, items[1].id)
  );

  const urls = [
    items[0].url ?? url1,
    items[1].url ?? url2,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative mx-4 flex h-[90vh] w-full max-w-6xl flex-col border border-[var(--mod-border)] bg-[var(--mono-900)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--mod-border)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--mono-white)]">Compare Evidence</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('split')}
              className={`p-2 ${viewMode === 'split' ? 'text-[var(--mono-white)]' : 'text-[var(--mod-text-dim)]'} hover:text-[var(--mono-white)]`}
              title="Side by side"
            >
              <IconColumns size={18} />
            </button>
            <button
              onClick={() => setViewMode('toggle')}
              className={`p-2 ${viewMode === 'toggle' ? 'text-[var(--mono-white)]' : 'text-[var(--mod-text-dim)]'} hover:text-[var(--mono-white)]`}
              title="Toggle view"
            >
              <IconRows size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'split' ? (
            <div className="grid h-full grid-cols-2 divide-x divide-[var(--mod-border)]">
              {items.map((item, idx) => (
                <ComparisonPane key={item.id} item={item} url={urls[idx] ?? null} />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Toggle buttons */}
              <div className="flex border-b border-[var(--mod-border)]">
                {items.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveIndex(idx)}
                    className={`flex-1 px-4 py-2 text-sm ${
                      activeIndex === idx
                        ? 'border-b-2 border-[var(--mono-white)] text-[var(--mono-white)]'
                        : 'text-[var(--mod-text-dim)] hover:text-[var(--mod-text-muted)]'
                    }`}
                  >
                    {item.originalFilename ?? item.description ?? `Evidence ${idx + 1}`}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto">
                <ComparisonPane item={items[activeIndex]!} url={urls[activeIndex] ?? null} />
              </div>
            </div>
          )}
        </div>

        {/* Footer with metadata comparison */}
        <div className="border-t border-[var(--mod-border)] px-4 py-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            {items.map((item, idx) => (
              <div key={item.id} className="text-[var(--mod-text-dim)]">
                <div className="mb-1 font-medium text-[var(--mono-white)]">
                  {EVIDENCE_TYPE_META[item.type].label}
                </div>
                <div>Uploaded: {new Date(item.createdAt).toLocaleString()}</div>
                <div>By: {item.uploadedByTag}</div>
                {item.sizeBytes && <div>Size: {(item.sizeBytes / 1024).toFixed(1)} KB</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonPane({ item, url }: { item: Evidence; url: string | null }) {
  if (item.type === 'URL' || item.type === 'DISCORD_URL') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-center text-sm text-[var(--mono-300)] underline hover:text-[var(--mono-white)]"
          >
            {item.url}
          </a>
        ) : (
          <span className="text-sm text-[var(--mod-text-dim)]">No URL provided</span>
        )}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--mod-text-dim)]">
        Loading...
      </div>
    );
  }

  if (item.type === 'IMAGE') {
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-4">
        <img
          src={url}
          alt={item.originalFilename ?? 'Evidence'}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (item.type === 'VIDEO') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <video src={url} controls className="max-h-full max-w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-[var(--mod-text-dim)]">
      Preview not available for {EVIDENCE_TYPE_META[item.type].label}
    </div>
  );
}
