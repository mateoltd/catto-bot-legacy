'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { getCaseNotes, addCaseNote } from '@/lib/services/mod.service';
import { IconSend } from '@/lib/mod-icons';
import { useFormatter, useTranslations } from 'next-intl';

interface CaseNotesProps {
  guildId: string;
  caseNumber: number;
}

const MENTION_REGEX = /@(\w+#\d{4}|\w+)/g;

function formatContent(content: string) {
  const parts = content.split(MENTION_REGEX);
  return parts.map((part, i) => {
    // Odd indices are captured mention groups
    if (i % 2 === 1) {
      return (
        <span key={i} className="bg-[var(--mono-800)] px-1 text-[var(--mono-300)]">
          @{part}
        </span>
      );
    }
    return part;
  });
}

export function CaseNotes({ guildId, caseNumber }: CaseNotesProps) {
  const t = useTranslations('Moderation');
  const format = useFormatter();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, mutate } = useSWR(
    ['case-notes', guildId, caseNumber],
    () => getCaseNotes(guildId, caseNumber),
  );

  const notes = data?.notes ?? [];

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);

    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { minutes: diffMins });

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('hoursAgo', { hours: diffHours });

    return format.dateTime(date, { dateStyle: 'short' });
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes.length]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const newNote = await addCaseNote(guildId, caseNumber, content);
      setInput('');
      // Optimistic update
      mutate(
        (prev) => prev ? { ...prev, notes: [...prev.notes, newNote], total: prev.total + 1 } : prev,
        { revalidate: false }
      );
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  }, [input, sending, guildId, caseNumber, mutate]);

  return (
    <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)]">
      <div className="border-b border-[var(--mod-border)] px-4 py-3">
        <h3 className="text-sm font-medium text-[var(--mono-white)]">
          {t('discussionWithCount', { count: data?.total ?? 0 })}
        </h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">{t('loadingNotes')}</div>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="py-4 text-center text-sm text-[var(--mod-text-dim)]">
            {t('noDiscussion')}
          </div>
        )}

        {notes.map((note) => (
          <div key={note.id} className="flex gap-3">
            {/* Avatar initial */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--mono-700)] text-xs font-medium text-[var(--mono-white)]">
              {note.authorTag.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--mono-white)]">{note.authorTag}</span>
                <span className="text-[10px] text-[var(--mod-text-dim)]">{formatTime(note.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--mod-text-muted)] break-words">
                {formatContent(note.content)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t border-[var(--mod-border)] p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t('addNotePlaceholder')}
          maxLength={2000}
          className="min-w-0 flex-1 border border-[var(--mod-border)] bg-[var(--mono-950)] px-3 py-2 text-sm text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label={t('sendNote')}
          className="flex items-center gap-1 border border-[var(--mono-500)] px-3 py-2 text-sm text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] disabled:opacity-30"
        >
          <IconSend size={14} />
        </button>
      </div>
    </div>
  );
}
