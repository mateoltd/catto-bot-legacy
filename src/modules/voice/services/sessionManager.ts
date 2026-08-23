import { container } from '@sapphire/framework';
import { CacheKey, getJson, deleteJson } from '#lib/cache/index.js';
import {
  type VoiceWatchSession,
  type VoiceTrackSession,
  VoiceWatchSessionSchema,
  VoiceTrackSessionSchema,
} from '../domain/types.js';

const EXPIRY_CHECK_INTERVAL = 30_000;

type SessionInfo = { type: 'watch' | 'track'; guildId: string; interactionId: string };

/**
 * Manages session expiry checking with interval-based polling
 */
class SessionExpiryManager {
  private interval: ReturnType<typeof globalThis.setInterval> | null = null;
  private sessions = new Map<string, SessionInfo>();
  private onWatchExpired:
    | ((guildId: string, interactionId: string, session: VoiceWatchSession) => Promise<void>)
    | null = null;
  private onTrackExpired:
    | ((guildId: string, interactionId: string, session: VoiceTrackSession) => Promise<void>)
    | null = null;

  setCallbacks(
    onWatchExpired: (
      guildId: string,
      interactionId: string,
      session: VoiceWatchSession
    ) => Promise<void>,
    onTrackExpired: (
      guildId: string,
      interactionId: string,
      session: VoiceTrackSession
    ) => Promise<void>
  ): void {
    this.onWatchExpired = onWatchExpired;
    this.onTrackExpired = onTrackExpired;
  }

  register(type: 'watch' | 'track', guildId: string, interactionId: string): void {
    const key = `${type}:${guildId}:${interactionId}`;
    this.sessions.set(key, { type, guildId, interactionId });

    if (!this.interval && this.sessions.size > 0) {
      this.startInterval();
    }
  }

  unregister(type: 'watch' | 'track', guildId: string, interactionId: string): void {
    const key = `${type}:${guildId}:${interactionId}`;
    this.sessions.delete(key);

    if (this.sessions.size === 0) {
      this.stopInterval();
    }
  }

  private startInterval(): void {
    if (this.interval) return;

    this.interval = globalThis.setInterval(() => {
      this.checkExpired().catch((err) => {
        container.logger.error('[SessionExpiryManager] Error:', err);
      });
    }, EXPIRY_CHECK_INTERVAL);
  }

  private stopInterval(): void {
    if (this.interval) {
      globalThis.clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkExpired(): Promise<void> {
    const now = Date.now();

    for (const [key, { type, guildId, interactionId }] of this.sessions) {
      try {
        if (type === 'watch') {
          const session = await getJson(
            CacheKey.voiceWatch(guildId, interactionId),
            VoiceWatchSessionSchema
          );
          if (!session) {
            this.sessions.delete(key);
            continue;
          }
          if (now >= session.endsAt && this.onWatchExpired) {
            await this.onWatchExpired(guildId, interactionId, session);
            this.sessions.delete(key);
          }
        } else {
          const session = await getJson(
            CacheKey.voiceTrack(guildId, interactionId),
            VoiceTrackSessionSchema
          );
          if (!session) {
            this.sessions.delete(key);
            continue;
          }
          if (now >= session.endsAt && this.onTrackExpired) {
            await this.onTrackExpired(guildId, interactionId, session);
            this.sessions.delete(key);
          }
        }
      } catch (error) {
        container.logger.error(`[SessionExpiryManager] Error checking ${key}:`, error);
      }
    }

    if (this.sessions.size === 0) {
      this.stopInterval();
    }
  }
}

export const sessionExpiryManager = new SessionExpiryManager();

/**
 * Cleanup watch session from Redis
 */
export async function cleanupWatchSession(
  guildId: string,
  interactionId: string,
  session: VoiceWatchSession
): Promise<void> {
  await deleteJson(CacheKey.voiceWatch(guildId, interactionId));
  await container.redis.srem(CacheKey.voiceWatchByTarget(guildId, session.targetId), interactionId);
  sessionExpiryManager.unregister('watch', guildId, interactionId);
}

/**
 * Cleanup track session from Redis
 */
export async function cleanupTrackSession(
  guildId: string,
  interactionId: string,
  session: VoiceTrackSession
): Promise<void> {
  await deleteJson(CacheKey.voiceTrack(guildId, interactionId));
  await container.redis.srem(
    CacheKey.voiceTrackByChannel(guildId, session.channelId),
    interactionId
  );
  sessionExpiryManager.unregister('track', guildId, interactionId);
}
