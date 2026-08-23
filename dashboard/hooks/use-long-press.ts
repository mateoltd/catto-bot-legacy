'use client';

import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onLongPress: () => void;
}

/**
 * Pointer-event based long-press hook.
 * Calls navigator.vibrate on trigger and suppresses subsequent click.
 */
export function useLongPress({ threshold = 500, onLongPress }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only respond to primary pointer (left click / first touch)
      if (e.button !== 0) return;
      triggeredRef.current = false;
      timerRef.current = setTimeout(() => {
        triggeredRef.current = true;
        navigator.vibrate?.(50);
        onLongPress();
      }, threshold);
    },
    [threshold, onLongPress]
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  const onClick = useCallback((e: React.MouseEvent) => {
    // Suppress click if long-press was triggered
    if (triggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      triggeredRef.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onClick,
  };
}
