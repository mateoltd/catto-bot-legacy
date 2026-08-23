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

  it('calls onPrev when ArrowLeft is pressed', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext }));

    act(() => dispatchKey('ArrowLeft'));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('calls onNext when ArrowRight is pressed', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext }));

    act(() => dispatchKey('ArrowRight'));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
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

  it('does not trigger when textarea is focused', () => {
    const onPrev = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext: undefined }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(onPrev).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('does nothing when onPrev/onNext is undefined', () => {
    // Should not throw
    renderHook(() => usePaginationNav({ onPrev: undefined, onNext: undefined }));

    // Dispatch from a real DOM element so e.target has .closest()
    const div = document.createElement('div');
    document.body.appendChild(div);

    act(() => {
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    document.body.removeChild(div);
    // No assertion needed - just shouldn't throw
  });

  it('passes swipe handlers to useSwipe with correct config', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext }));

    expect(mockUseSwipe).toHaveBeenCalledWith({
      onSwipeLeft: onNext, // swipe left = next page
      onSwipeRight: onPrev, // swipe right = prev page
    });
  });

  it('passes undefined to useSwipe when disabled', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    renderHook(() => usePaginationNav({ onPrev, onNext, disabled: true }));

    expect(mockUseSwipe).toHaveBeenCalledWith({
      onSwipeLeft: undefined,
      onSwipeRight: undefined,
    });
  });

  it('cleans up keyboard listener on unmount', () => {
    const onPrev = vi.fn();
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() =>
      usePaginationNav({ onPrev, onNext: undefined })
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
