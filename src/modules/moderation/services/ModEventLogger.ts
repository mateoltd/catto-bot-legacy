/**
 * ModEventLogger - Comprehensive event tracking for moderation actions
 *
 * Logs events to Redis streams for real-time queries and batches to PostgreSQL
 * for long-term analytics.
 */

import { container } from '@sapphire/framework';
import { ModAction, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { GuildId, UserId, CaseNumber } from '../domain/types.js';

// Event category types
export type EventCategory = 'punishment' | 'info' | 'config' | 'appeal' | 'system';
export type ActorType = 'user' | 'bot' | 'automod' | 'system';
export type TargetType = 'user' | 'message' | 'channel' | 'role';

/**
 * Core event data structure for all moderation events
 */
export interface ModEventData {
  eventId: string;
  guildId: GuildId;
  timestamp: Date;

  // Actor information
  actorId: UserId;
  actorType: ActorType;

  // Target information (optional for config changes)
  targetId?: UserId;
  targetType?: TargetType;

  // Action details
  action: ModAction | string;
  category: EventCategory;

  // Context
  reason?: string;
  metadata: Prisma.JsonObject;

  // Outcome
  success: boolean;
  errorType?: string;
  latencyMs: number;

  // Correlation
  caseId?: string;
  caseNumber?: CaseNumber;
  correlationId?: string;
}

/**
 * Punishment-specific event data
 */
export interface PunishmentEventData {
  guildId: GuildId;
  targetId: UserId;
  moderatorId: UserId;
  action: ModAction;
  reason?: string;
  duration?: number;
  caseNumber?: CaseNumber;
  success: boolean;
  error?: string;
  latencyMs: number;
}

/**
 * Config change event data
 */
export interface ConfigChangeData {
  guildId: GuildId;
  changedById: UserId;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Batch buffer for events pending database insert
 */
interface EventBatch {
  events: ModEventData[];
  lastFlush: Date;
}

/**
 * ModEventLogger - Logs moderation events for analytics
 */
class ModEventLoggerService {
  private batch: EventBatch = {
    events: [],
    lastFlush: new Date(),
  };
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 60_000; // 1 minute

  /**
   * Initialize the event logger
   */
  async initialize(): Promise<void> {
    // Start the flush interval
    this.flushInterval = setInterval(() => {
      void this.flushBatch().catch((err) => {
        container.logger.error('[ModEventLogger] Batch flush failed:', err);
      });
    }, this.FLUSH_INTERVAL_MS);

    container.logger.info('[ModEventLogger] Initialized');
  }

  /**
   * Shutdown the event logger
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining events
    await this.flushBatch();
    container.logger.info('[ModEventLogger] Shutdown complete');
  }

  /**
   * Log a generic moderation event
   */
  async logEvent(data: Omit<ModEventData, 'eventId' | 'timestamp'>): Promise<string> {
    const event: ModEventData = {
      eventId: randomUUID(),
      timestamp: new Date(),
      ...data,
    };

    // Add to batch
    this.batch.events.push(event);

    // Flush if batch is full
    if (this.batch.events.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    }

    // Also log to Redis for real-time queries
    await this.logToRedis(event);

    return event.eventId;
  }

  /**
   * Log a punishment event (convenience method)
   */
  async logPunishment(data: PunishmentEventData): Promise<string> {
    return this.logEvent({
      guildId: data.guildId,
      actorId: data.moderatorId,
      actorType: 'user',
      targetId: data.targetId,
      targetType: 'user',
      action: data.action,
      category: 'punishment',
      reason: data.reason,
      metadata: {
        duration: data.duration,
      },
      success: data.success,
      errorType: data.error,
      latencyMs: data.latencyMs,
      caseNumber: data.caseNumber,
    });
  }

  /**
   * Log a config change event
   */
  async logConfigChange(data: ConfigChangeData): Promise<string> {
    return this.logEvent({
      guildId: data.guildId,
      actorId: data.changedById,
      actorType: 'user',
      action: 'CONFIG_CHANGE',
      category: 'config',
      metadata: {
        field: data.field,
        oldValue: String(data.oldValue),
        newValue: String(data.newValue),
      } as Prisma.JsonObject,
      success: true,
      latencyMs: 0,
    });
  }

  /**
   * Log a button interaction event
   */
  async logButtonInteraction(
    guildId: GuildId,
    userId: UserId,
    buttonId: string,
    targetId?: UserId,
    latencyMs: number = 0
  ): Promise<string> {
    return this.logEvent({
      guildId,
      actorId: userId,
      actorType: 'user',
      targetId,
      targetType: targetId ? 'user' : undefined,
      action: `BUTTON_${buttonId.toUpperCase()}`,
      category: 'info',
      metadata: {
        buttonId,
      },
      success: true,
      latencyMs,
    });
  }

  /**
   * Log an automod trigger event
   */
  async logAutomodTrigger(
    guildId: GuildId,
    targetId: UserId,
    triggerType: string,
    action: ModAction | null,
    success: boolean,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    return this.logEvent({
      guildId,
      actorId: 'system' as UserId,
      actorType: 'automod',
      targetId,
      targetType: 'user',
      action: action ?? `AUTOMOD_${triggerType.toUpperCase()}`,
      category: 'punishment',
      metadata: {
        triggerType,
        ...metadata,
      },
      success,
      latencyMs: 0,
    });
  }

  /**
   * Log a scheduler job event
   */
  async logSchedulerJob(
    guildId: GuildId,
    jobType: string,
    targetId: UserId,
    success: boolean,
    error?: string,
    metadata: Prisma.JsonObject = {}
  ): Promise<string> {
    return this.logEvent({
      guildId,
      actorId: 'system' as UserId,
      actorType: 'system',
      targetId,
      targetType: 'user',
      action: `SCHEDULER_${jobType.toUpperCase()}`,
      category: 'system',
      metadata,
      success,
      errorType: error,
      latencyMs: 0,
    });
  }

  /**
   * Get events for a guild within a time range
   */
  async getGuildEvents(
    guildId: GuildId,
    options: {
      startTime?: Date;
      endTime?: Date;
      category?: EventCategory;
      action?: ModAction | string;
      limit?: number;
    } = {}
  ): Promise<ModEventData[]> {
    const { startTime, endTime, category, action, limit = 100 } = options;

    const where: Record<string, unknown> = { guildId };

    if (startTime) {
      where.timestamp = { ...((where.timestamp as object) || {}), gte: startTime };
    }
    if (endTime) {
      where.timestamp = { ...((where.timestamp as object) || {}), lte: endTime };
    }
    if (category) {
      where.category = category;
    }
    if (action) {
      where.action = action;
    }

    const events = await container.prisma.modEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      eventId: e.id,
      guildId: e.guildId as GuildId,
      timestamp: e.timestamp,
      actorId: e.actorId as UserId,
      actorType: e.actorType as ActorType,
      targetId: e.targetId as UserId | undefined,
      targetType: e.targetType as TargetType | undefined,
      action: e.action,
      category: e.category as EventCategory,
      reason: e.reason ?? undefined,
      metadata: (e.metadata ?? {}) as Prisma.JsonObject,
      success: e.success,
      errorType: e.errorType ?? undefined,
      latencyMs: e.latencyMs ?? 0,
      caseNumber: e.caseNumber as CaseNumber | undefined,
      correlationId: e.correlationId ?? undefined,
    }));
  }

  /**
   * Get event statistics for a guild
   */
  async getGuildStats(
    guildId: GuildId,
    startTime: Date,
    endTime: Date = new Date()
  ): Promise<{
    totalEvents: number;
    byCategory: Record<EventCategory, number>;
    byAction: Record<string, number>;
    successRate: number;
    avgLatencyMs: number;
  }> {
    const events = await container.prisma.modEvent.findMany({
      where: {
        guildId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      select: {
        category: true,
        action: true,
        success: true,
        latencyMs: true,
      },
    });

    const byCategory: Record<EventCategory, number> = {
      punishment: 0,
      info: 0,
      config: 0,
      appeal: 0,
      system: 0,
    };

    const byAction: Record<string, number> = {};
    let successCount = 0;
    let totalLatency = 0;

    for (const event of events) {
      byCategory[event.category as EventCategory]++;
      byAction[event.action] = (byAction[event.action] || 0) + 1;
      if (event.success) successCount++;
      totalLatency += event.latencyMs;
    }

    return {
      totalEvents: events.length,
      byCategory,
      byAction,
      successRate: events.length > 0 ? successCount / events.length : 1,
      avgLatencyMs: events.length > 0 ? totalLatency / events.length : 0,
    };
  }

  /**
   * Flush the event batch to PostgreSQL
   */
  async flushBatch(): Promise<void> {
    if (this.batch.events.length === 0) return;

    const eventsToFlush = [...this.batch.events];
    this.batch.events = [];
    this.batch.lastFlush = new Date();

    try {
      await container.prisma.modEvent.createMany({
        data: eventsToFlush.map((e) => ({
          id: e.eventId,
          guildId: e.guildId,
          timestamp: e.timestamp,
          actorId: e.actorId,
          actorType: e.actorType,
          targetId: e.targetId,
          targetType: e.targetType,
          action: String(e.action),
          category: e.category,
          reason: e.reason,
          metadata: e.metadata satisfies Prisma.JsonObject,
          success: e.success,
          errorType: e.errorType,
          latencyMs: e.latencyMs,
          caseNumber: e.caseNumber,
          correlationId: e.correlationId,
        })),
        skipDuplicates: true,
      });

      container.logger.debug(`[ModEventLogger] Flushed ${eventsToFlush.length} events to database`);
    } catch (error) {
      container.logger.error('[ModEventLogger] Failed to flush batch:', error);
      // Re-add events to batch on failure (with limit to prevent memory issues)
      if (this.batch.events.length < this.BATCH_SIZE * 2) {
        this.batch.events.unshift(...eventsToFlush);
      }
    }
  }

  /**
   * Log event to Redis stream for real-time queries
   */
  private async logToRedis(event: ModEventData): Promise<void> {
    try {
      const redis = container.redis;
      if (!redis) return;

      const streamKey = `mod:events:${event.guildId}`;
      const eventData: Record<string, string> = {
        eventId: event.eventId,
        actorId: event.actorId,
        actorType: event.actorType,
        action: String(event.action),
        category: event.category,
        success: String(event.success),
        latencyMs: String(event.latencyMs),
        timestamp: event.timestamp.toISOString(),
      };

      if (event.targetId) eventData.targetId = event.targetId;
      if (event.targetType) eventData.targetType = event.targetType;
      if (event.reason) eventData.reason = event.reason;
      if (event.caseNumber) eventData.caseNumber = String(event.caseNumber);

      await redis.xadd(streamKey, 'MAXLEN', '~', '10000', '*', ...Object.entries(eventData).flat());

      // Set TTL on stream (7 days)
      await redis.expire(streamKey, 7 * 24 * 60 * 60);
    } catch (error) {
      container.logger.debug('[ModEventLogger] Redis logging failed (non-critical):', error);
    }
  }
}

// Export singleton instance
export const modEventLogger = new ModEventLoggerService();
