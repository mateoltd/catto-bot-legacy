/**
 * Weight Gate - Upload weight tracking per user per guild
 *
 * Tracks cumulative upload size within a sliding window to prevent abuse.
 * Uses Redis for distributed tracking.
 */

import { container } from '@sapphire/framework';

export interface WeightResult {
  allowed: boolean;
  used: number;
  max: number;
}

export class WeightGate {
  /** Maximum bytes per user per guild within the session window */
  static readonly MAX_SESSION_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

  /** Session window duration */
  static readonly SESSION_WINDOW_MS = 3_600_000; // 1 hour

  /**
   * Check if a user can upload additional bytes within their weight limit.
   */
  static async checkUploadWeight(
    userId: string,
    guildId: string,
    fileBytes: number,
    maxBytes?: number
  ): Promise<WeightResult> {
    const max = maxBytes ?? WeightGate.MAX_SESSION_BYTES;

    try {
      const redis = (container as unknown as { redis?: import('ioredis').default }).redis;
      if (!redis) {
        // Fail closed if Redis unavailable — deny uploads when we can't track weight
        return { allowed: false, used: 0, max };
      }

      const key = `weight:upload:${userId}:${guildId}`;
      const currentStr = await redis.get(key);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current + fileBytes > max) {
        return { allowed: false, used: current, max };
      }

      return { allowed: true, used: current, max };
    } catch {
      // Fail closed on Redis errors — deny uploads when we can't track weight
      return { allowed: false, used: 0, max };
    }
  }

  /**
   * Record an upload's weight after successful completion.
   */
  static async recordUpload(userId: string, guildId: string, fileBytes: number): Promise<void> {
    try {
      const redis = (container as unknown as { redis?: import('ioredis').default }).redis;
      if (!redis) return;

      const key = `weight:upload:${userId}:${guildId}`;
      const pipeline = redis.pipeline();
      pipeline.incrby(key, fileBytes);
      pipeline.pexpire(key, WeightGate.SESSION_WINDOW_MS);
      await pipeline.exec();
    } catch {
      // Non-critical
    }
  }

  /**
   * Get current session usage for a user in a guild.
   */
  static async getSessionUsage(
    userId: string,
    guildId: string
  ): Promise<{ used: number; max: number }> {
    try {
      const redis = (container as unknown as { redis?: import('ioredis').default }).redis;
      if (!redis) return { used: 0, max: WeightGate.MAX_SESSION_BYTES };

      const key = `weight:upload:${userId}:${guildId}`;
      const currentStr = await redis.get(key);
      const used = currentStr ? parseInt(currentStr, 10) : 0;

      return { used, max: WeightGate.MAX_SESSION_BYTES };
    } catch {
      return { used: 0, max: WeightGate.MAX_SESSION_BYTES };
    }
  }
}
