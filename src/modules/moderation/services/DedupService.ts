/**
 * Mod Action Deduplication Service
 *
 * Prevents multiple moderators from accidentally sanctioning the same user
 * twice for the same infraction within a short time window.
 *
 * Uses Redis with a ~2 minute TTL to track recent punitive mod actions.
 * When a duplicate is detected, the second moderator receives a warning
 * and can choose to confirm/override.
 *
 * @see https://github.com/cattxdev/catto.v2/issues/114
 */

import { container } from '@sapphire/framework';
import { ModAction } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { setCache, getCache, deleteCache } from '#lib/redis.js';

/** TTL for dedup entries in seconds (~2 minutes) */
const DEDUP_TTL_SECONDS = 120;

/** TTL for pending override entries in seconds (5 minutes) */
const PENDING_OVERRIDE_TTL_SECONDS = 300;

/** Actions that are considered punitive and should be dedup-checked */
const PUNITIVE_ACTIONS = new Set<ModAction>([
  ModAction.WARN,
  ModAction.KICK,
  ModAction.BAN,
  ModAction.SOFTBAN,
  ModAction.TIMEOUT,
  ModAction.TEMPBAN,
  ModAction.MUTE_TEXT,
  ModAction.MUTE_VOICE,
  ModAction.MUTE_BOTH,
]);

/**
 * Information about a recent mod action stored in the dedup cache
 */
export interface DedupEntry {
  /** The moderator who performed the action */
  moderatorId: string;
  /** Display tag of the moderator */
  moderatorTag: string;
  /** When the action was performed (epoch ms) */
  timestamp: number;
  /** The reason provided for the action */
  reason: string;
}

/**
 * Result of a dedup check
 */
export interface DedupCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;
  /** Details of the existing action (only set when isDuplicate is true) */
  existing?: DedupEntry;
}

/**
 * Pending override data stored in Redis for confirm button flow
 */
export interface PendingOverride {
  guildId: string;
  targetId: string;
  action: string;
  reason: string;
  duration?: number;
  moderatorId: string;
  /** Additional context like deleteMessages for ban */
  extra?: Record<string, unknown>;
}

// ─── Cache Key Builders ───

function dedupKey(guildId: string, userId: string, action: ModAction): string {
  return `mod:dedup:${guildId}:${userId}:${action}`;
}

function pendingOverrideKey(pendingId: string): string {
  return `mod:dedup:pending:${pendingId}`;
}

// ─── Service Functions ───

/**
 * Check whether a mod action on this user was recently performed.
 * If no duplicate exists, records the current action for future checks.
 *
 * @param guildId - Guild where the action is taking place
 * @param targetId - The user being moderated
 * @param action - The mod action type
 * @param moderatorId - The moderator performing the action
 * @param moderatorTag - Display tag of the moderator
 * @param reason - The reason for the action
 * @returns DedupCheckResult indicating whether a duplicate was found
 */
export async function checkAndSetDedup(
  guildId: string,
  targetId: string,
  action: ModAction,
  moderatorId: string,
  moderatorTag: string,
  reason: string
): Promise<DedupCheckResult> {
  // Only check punitive actions
  if (!PUNITIVE_ACTIONS.has(action)) {
    return { isDuplicate: false };
  }

  const key = dedupKey(guildId, targetId, action);

  try {
    const entry: DedupEntry = {
      moderatorId,
      moderatorTag,
      timestamp: Date.now(),
      reason,
    };

    // Atomic set-if-not-exists to prevent race conditions between check and set
    const setResult = await container.redis.set(
      key,
      JSON.stringify(entry),
      'EX',
      DEDUP_TTL_SECONDS,
      'NX'
    );

    if (setResult === 'OK') {
      // We claimed the slot — no duplicate
      return { isDuplicate: false };
    }

    // Key already exists — check if it's a different moderator
    const existing = await getCache<DedupEntry>(key, true);

    if (existing && existing.moderatorId !== moderatorId) {
      // Different moderator tried the same action — duplicate detected
      return { isDuplicate: true, existing };
    }

    // Same moderator retrying — allow and refresh the entry
    await setCache(key, entry, DEDUP_TTL_SECONDS);
    return { isDuplicate: false };
  } catch (error) {
    // If Redis is down, don't block the mod action — just log and continue
    container.logger.warn('[DedupService] Redis error during dedup check:', error);
    return { isDuplicate: false };
  }
}

/**
 * Clear the dedup entry for a specific action.
 * Useful when an action is reverted (e.g. unban clears the ban dedup).
 */
export async function clearDedup(
  guildId: string,
  targetId: string,
  action: ModAction
): Promise<void> {
  try {
    await deleteCache(dedupKey(guildId, targetId, action));
  } catch (error) {
    container.logger.warn('[DedupService] Redis error during dedup clear:', error);
  }
}

/**
 * Store a pending override so the confirm button can re-execute the action.
 *
 * @returns A short unique key to reference this pending action
 */
export async function storePendingOverride(data: PendingOverride): Promise<string> {
  const pendingId = generatePendingId();
  const key = pendingOverrideKey(pendingId);
  await setCache(key, data, PENDING_OVERRIDE_TTL_SECONDS);
  return pendingId;
}

/**
 * Retrieve and consume a pending override (one-time use).
 */
export async function consumePendingOverride(pendingId: string): Promise<PendingOverride | null> {
  const key = pendingOverrideKey(pendingId);
  try {
    const data = await getCache<PendingOverride>(key, true);
    if (data) {
      await deleteCache(key); // one-time use
    }
    return data;
  } catch (error) {
    container.logger.warn('[DedupService] Redis error during pending override consume:', error);
    return null;
  }
}

/**
 * Retrieve a pending override without consuming it.
 */
export async function getPendingOverride(pendingId: string): Promise<PendingOverride | null> {
  const key = pendingOverrideKey(pendingId);
  try {
    return await getCache<PendingOverride>(key, true);
  } catch (error) {
    container.logger.warn('[DedupService] Redis error during pending override read:', error);
    return null;
  }
}

/**
 * Force-set the dedup entry (used after an override confirm to prevent
 * yet another moderator from duplicating).
 */
export async function setDedup(
  guildId: string,
  targetId: string,
  action: ModAction,
  moderatorId: string,
  moderatorTag: string,
  reason: string
): Promise<void> {
  const key = dedupKey(guildId, targetId, action);
  const entry: DedupEntry = {
    moderatorId,
    moderatorTag,
    timestamp: Date.now(),
    reason,
  };
  try {
    await setCache(key, entry, DEDUP_TTL_SECONDS);
  } catch (error) {
    container.logger.warn('[DedupService] Redis error during dedup set:', error);
  }
}

// ─── Helpers ───

function generatePendingId(): string {
  return randomBytes(12).toString('base64url');
}
