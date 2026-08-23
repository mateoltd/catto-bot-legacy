'use client';

import { useRef, useCallback } from 'react';

interface UseSwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  threshold?: number;
  edgeGuard?: number;
}

/**
 * Pointer-event based swipe detection.
 * Only fires for touch pointers. Requires primary axis delta > 1.5x secondary axis.
 * Ignores swipes starting within edgeGuard px of screen edge (browser back gesture).
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  onSwipeUp,
  threshold = 50,
  edgeGuard = 30,
}: UseSwipeConfig) {
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      // Ignore swipes starting near screen edges
      if (e.clientX < edgeGuard || e.clientX > window.innerWidth - edgeGuard) return;
      startRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    },
    [edgeGuard]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || e.pointerId !== startRef.current.pointerId) return;

      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      startRef.current = null;

      // Must exceed threshold and be primarily in one direction
      if (absDx > absDy && absDx >= threshold && absDx > absDy * 1.5) {
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
      } else if (absDy > absDx && absDy >= threshold && absDy > absDx * 1.5) {
        if (dy < 0) onSwipeUp?.();
        else onSwipeDown?.();
      }
    },
    [threshold, onSwipeLeft, onSwipeRight, onSwipeDown, onSwipeUp]
  );

  const onPointerCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  };
}
