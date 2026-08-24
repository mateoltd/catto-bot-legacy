'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface ModEvent {
  type:
    | 'evidence:created'
    | 'evidence:amended'
    | 'evidence:status-changed'
    | 'case:created'
    | 'case:updated'
    | 'case:closed';
  guildId: string;
  caseNumber?: number;
  evidenceId?: string;
  data?: Record<string, unknown>;
}

interface UseModEventsOptions {
  guildId: string;
  enabled?: boolean;
  onEvent: (event: ModEvent) => void;
}

const MAX_BACKOFF_MS = 30_000;

export function useModEvents({ guildId, enabled = true, onEvent }: UseModEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `/api/guilds/${guildId}/moderation/events`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      // Reset backoff on successful connection
      backoffRef.current = 1000;
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ModEvent;
        onEventRef.current(parsed);
      } catch {
        // Ignore unparseable messages (heartbeats, etc.)
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [guildId]);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [guildId, enabled, connect]);

  // Pause SSE when tab is backgrounded (especially important on mobile)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden — disconnect
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      } else {
        // Tab visible — reconnect
        backoffRef.current = 1000;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, connect]);
}
