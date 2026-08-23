/**
 * Auth Events - Custom events for session state changes
 *
 * Uses native CustomEvent API to decouple auth state from React state.
 * Components can listen for these events without prop drilling or context.
 */

export const AUTH_EVENTS = {
  SESSION_EXPIRED: 'auth:session-expired',
} as const;

/**
 * Emit a session expired event. Called by the API interceptor on 401.
 */
export function emitSessionExpired() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_EXPIRED));
}

/**
 * Subscribe to session expired events.
 * Returns an unsubscribe function.
 */
export function onSessionExpired(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_EVENTS.SESSION_EXPIRED, callback);
  return () => window.removeEventListener(AUTH_EVENTS.SESSION_EXPIRED, callback);
}
