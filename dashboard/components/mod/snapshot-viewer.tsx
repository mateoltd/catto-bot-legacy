'use client';

import type { MessageSnapshot, MessageSnapshotEntry } from '@/lib/mod-types';
import { IconFile } from '@/lib/mod-icons';

interface SnapshotViewerProps {
  snapshot: MessageSnapshot;
}

export function SnapshotViewer({ snapshot }: SnapshotViewerProps) {
  const messages = snapshot.snapshotData;

  return (
    <div className="space-y-0">
      {/* Snapshot header */}
      <div className="mb-3 flex items-center gap-3 text-xs text-[var(--mod-text-dim)]">
        <span>Channel: {snapshot.channelId}</span>
        <span>{snapshot.messageCount} message{snapshot.messageCount !== 1 ? 's' : ''}</span>
        <span>Captured by {snapshot.capturedByTag}</span>
        <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
      </div>

      {/* Messages */}
      <div className="border border-[var(--mod-border)] bg-[var(--mono-950)] divide-y divide-[var(--mod-border)]">
        {messages.map((msg) => (
          <SnapshotMessage key={msg.messageId} message={msg} />
        ))}
      </div>

      {/* Integrity info */}
      <div className="mt-2 text-xs text-[var(--mod-text-dim)]">
        <span className="font-mono">Hash: {snapshot.contentHash.slice(0, 16)}...</span>
        <span className="ml-3">Signed & Verified</span>
      </div>
    </div>
  );
}

function SnapshotMessage({ message }: { message: MessageSnapshotEntry }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      {/* Avatar */}
      <div className="shrink-0">
        {message.authorAvatarUrl ? (
          <img
            src={message.authorAvatarUrl}
            alt=""
            className="h-8 w-8"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center bg-[var(--mono-700)] text-xs text-[var(--mod-text-dim)]">
            {message.authorTag.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Author line */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-[var(--mono-white)]">{message.authorTag}</span>
          <span className="text-xs text-[var(--mod-text-dim)]">
            {new Date(message.createdAt).toLocaleString()}
            {message.editedAt && ' (edited)'}
          </span>
        </div>

        {/* Text content */}
        {message.content && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--mod-text)]">
            {message.content}
          </p>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1 border border-[var(--mod-border)] bg-[var(--mod-surface)] px-2 py-1 text-xs text-[var(--mod-text-dim)]"
              >
                <IconFile size={12} />
                {att.filename} ({(att.size / 1024).toFixed(1)} KB)
              </div>
            ))}
          </div>
        )}

        {/* Stickers */}
        {message.stickers.length > 0 && (
          <div className="mt-1 flex gap-1">
            {message.stickers.map((s, i) => (
              <span key={i} className="text-xs text-[var(--mod-text-dim)]">
                [Sticker: {s.name}]
              </span>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactions.map((r, i) => (
              <span
                key={i}
                className="border border-[var(--mod-border)] bg-[var(--mod-surface)] px-2 py-0.5 text-xs text-[var(--mod-text-dim)]"
              >
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
