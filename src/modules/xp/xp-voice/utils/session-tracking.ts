/**
 * Voice Session Tracking with Redis
 * Manages active voice sessions in Redis for persistence and scalability
 */

import { container } from '@sapphire/framework';
import type { ActiveSession } from '../types/voice-xp.types.js';

const SESSION_PREFIX = 'voice-session:';
const GUILD_SESSIONS_PREFIX = 'voice-guild-sessions:';

/**
 * Get Redis key for a session
 */
function getSessionKey(guildId: string, userId: string): string {
  return `${SESSION_PREFIX}${guildId}:${userId}`;
}

/**
 * Get Redis key for guild sessions set
 */
function getGuildSessionsKey(guildId: string): string {
  return `${GUILD_SESSIONS_PREFIX}${guildId}`;
}

/**
 * Start tracking a voice session
 */
export async function startSession(session: ActiveSession): Promise<void> {
  const key = getSessionKey(session.guildId, session.userId);
  const guildSetKey = getGuildSessionsKey(session.guildId);

  await container.redis.set(key, JSON.stringify(session));
  await container.redis.sadd(guildSetKey, session.userId);
}

/**
 * Get active session for a user
 */
export async function getActiveSession(
  guildId: string,
  userId: string
): Promise<ActiveSession | null> {
  const key = getSessionKey(guildId, userId);
  const data = await container.redis.get(key);

  if (!data) return null;

  try {
    return JSON.parse(data) as ActiveSession;
  } catch (error) {
    container.logger.error(
      `[Voice XP] Failed to parse session data for ${guildId}:${userId}`,
      error
    );
    return null;
  }
}

/**
 * End and remove a session
 */
export async function endSession(guildId: string, userId: string): Promise<ActiveSession | null> {
  const session = await getActiveSession(guildId, userId);
  if (!session) return null;

  const key = getSessionKey(guildId, userId);
  const guildSetKey = getGuildSessionsKey(guildId);

  await container.redis.del(key);
  await container.redis.srem(guildSetKey, session.userId);

  return session;
}

/**
 * Calculate session duration in minutes
 */
export function calculateSessionDuration(joinedAt: Date, leftAt: Date = new Date()): number {
  const durationMs = leftAt.getTime() - joinedAt.getTime();
  return Math.floor(durationMs / 1000 / 60);
}

/**
 * Check if minimum session duration is met
 */
export function meetsMinimumDuration(joinedAt: Date, minMinutes: number): boolean {
  const duration = calculateSessionDuration(joinedAt);
  return duration >= minMinutes;
}

/**
 * Get all active sessions for a guild
 */
export async function getGuildActiveSessions(guildId: string): Promise<ActiveSession[]> {
  const guildSetKey = getGuildSessionsKey(guildId);
  const userIds = await container.redis.smembers(guildSetKey);

  const sessions: ActiveSession[] = [];

  for (const userId of userIds) {
    const session = await getActiveSession(guildId, userId);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}

/**
 * Clear all sessions (useful for bot restarts)
 */
export async function clearAllSessions(): Promise<void> {
  const pattern = `${SESSION_PREFIX}*`;
  const keys = await container.redis.keys(pattern);

  if (keys.length > 0) {
    await container.redis.del(...keys);
  }

  const guildPattern = `${GUILD_SESSIONS_PREFIX}*`;
  const guildKeys = await container.redis.keys(guildPattern);

  if (guildKeys.length > 0) {
    await container.redis.del(...guildKeys);
  }
}

/**
 * Get session count
 */
export async function getSessionCount(): Promise<number> {
  const pattern = `${SESSION_PREFIX}*`;
  const keys = await container.redis.keys(pattern);
  return keys.length;
}

/**
 * Update session data (for state changes like mute/unmute)
 */
export async function updateSession(
  guildId: string,
  userId: string,
  updates: Partial<ActiveSession>
): Promise<boolean> {
  const session = await getActiveSession(guildId, userId);
  if (!session) return false;

  const updatedSession = { ...session, ...updates };
  const key = getSessionKey(guildId, userId);

  await container.redis.set(key, JSON.stringify(updatedSession));
  return true;
}
