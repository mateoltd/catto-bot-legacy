import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the useSwipe hook
const { mockUseSwipe } = vi.hoisted(() => ({
  mockUseSwipe: vi.fn(() => ({
    onTouchStart: vi.fn(),
    onTouchEnd: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-swipe', () => ({
  useSwipe: mockUseSwipe,
}));

import { usePaginationNav } from '@/hooks/use-pagination-nav';

describe('usePaginationNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to dispatch key events from a real DOM element (happy-dom needs .closest on target)
  function dispatchKey(key: string) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    document.body.removeChild(div);
  }

  it('navigates with the left and right arrow keys', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext }));

    act(() => dispatchKey('ArrowLeft'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();

    act(() => dispatchKey('ArrowRight'));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when disabled', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext, disabled: true }));

    act(() => {
      dispatchKey('ArrowLeft');
      dispatchKey('ArrowRight');
    });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not trigger when input is focused', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext }));

    // Simulate keyboard event from an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(onPrev).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
