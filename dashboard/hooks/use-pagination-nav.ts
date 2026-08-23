'use client';

import { useEffect } from 'react';
import { useSwipe } from './use-swipe';

interface UsePaginationNavConfig {
  onPrev: (() => void) | undefined;
  onNext: (() => void) | undefined;
  /** Disable keyboard shortcuts (e.g. when a modal is open) */
  disabled?: boolean;
}

/**
 * Keyboard arrow keys (Left/Right) + mobile swipe for pagination
 * Returns swipe handler props to spread on a container element
 */
export function usePaginationNav({ onPrev, onNext, disabled }: UsePaginationNavConfig) {
  // Keyboard: Left/Right arrow keys
  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Don't intercept when a Radix select or dialog is open
      if ((e.target as HTMLElement)?.closest('[role="listbox"], [role="dialog"]')) return;

      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext, disabled]);

  // Swipe: Left = next page, Right = prev page (natural scroll direction)
  const swipeHandlers = useSwipe({
    onSwipeLeft: disabled ? undefined : onNext,
    onSwipeRight: disabled ? undefined : onPrev,
  });

  return swipeHandlers;
}
