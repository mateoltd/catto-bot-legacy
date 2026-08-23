import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emitSessionExpired, onSessionExpired, AUTH_EVENTS } from '@/lib/auth-events';

describe('auth-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emitSessionExpired dispatches custom event on window', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');

    emitSessionExpired();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AUTH_EVENTS.SESSION_EXPIRED,
      })
    );
  });

  it('onSessionExpired subscribes to session expired events', () => {
    const callback = vi.fn();
    const unsubscribe = onSessionExpired(callback);

    emitSessionExpired();

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('unsubscribe stops receiving events', () => {
    const callback = vi.fn();
    const unsubscribe = onSessionExpired(callback);

    emitSessionExpired();
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitSessionExpired();
    expect(callback).toHaveBeenCalledTimes(1); // No additional call
  });

  it('multiple subscribers all receive events', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = onSessionExpired(cb1);
    const unsub2 = onSessionExpired(cb2);

    emitSessionExpired();

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });
});
