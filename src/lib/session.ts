/**
 * Server-side session resolution helpers.
 *
 * Sessions are opaque UUID v4 IDs stored in the DASHBOARD_AUTH cookie,
 * backed by Redis via the typed cache layer.
 */

import type { Route } from '@sapphire/plugin-api';
import { getJson, SessionDataSchema, CacheKey, decryptSessionData } from '#lib/cache/typedCache.js';
import { z } from 'zod';

export type SessionData = z.infer<typeof SessionDataSchema>;

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check whether a value looks like a UUID v4 session ID
 * (as opposed to a raw Discord access token).
 */
export function isSessionId(value: string): boolean {
  return UUID_V4_RE.test(value);
}

/**
 * Extract the session ID (or legacy raw token) from the request.
 * Checks the DASHBOARD_AUTH cookie first, then the Authorization: Bearer header.
 */
export function extractSessionId(request: Route.Request): string | null {
  const cookies = request.headers.cookie;
  if (cookies) {
    const match = cookies.match(/DASHBOARD_AUTH=([^;]+)/);
    if (match?.[1]) return match[1];
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

// Clock skew tolerance (30 seconds) to handle minor time differences between servers
const CLOCK_SKEW_TOLERANCE_MS = 30_000;

/**
 * Look up a session in Redis by its ID.
 * Returns the session data if found and not expired, or null otherwise.
 */
export async function resolveSession(sessionId: string): Promise<SessionData | null> {
  const data = await getJson(CacheKey.session(sessionId), SessionDataSchema);
  if (!data) return null;

  // Check expiry with clock skew tolerance
  const expiresAt = new Date(data.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return null;
  }
  const now = Date.now();
  if (expiresAt + CLOCK_SKEW_TOLERANCE_MS <= now) {
    return null;
  }

  // Decrypt tokens before returning
  return decryptSessionData(data);
}
