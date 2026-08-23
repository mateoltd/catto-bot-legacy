/**
 * AccessLogService - Chain of custody logging for evidence access
 *
 * Logs VIEW, DOWNLOAD, and EXPORT actions for audit trails.
 * IP addresses are hashed with SHA-256 for privacy.
 */

import { createHmac } from 'node:crypto';
import { container } from '@sapphire/framework';
import type { Route } from '@sapphire/plugin-api';
import type { EvidenceAccessLog, Prisma } from '@prisma/client';
import { CONFIG } from '#config.js';

export type AccessAction = 'VIEW' | 'DOWNLOAD' | 'EXPORT';

export interface AccessLogEntry {
  id: string;
  evidenceId: string;
  guildId: string;
  userId: string;
  userTag: string;
  action: AccessAction;
  ipHash: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AccessLogOptions {
  page?: number;
  limit?: number;
}

class AccessLogServiceClass {
  /**
   * Log an access event for evidence.
   */
  async logAccess(
    evidenceId: string,
    guildId: string,
    userId: string,
    userTag: string,
    action: AccessAction,
    request?: Route.Request,
    metadata?: Record<string, unknown>
  ): Promise<EvidenceAccessLog> {
    // Hash IP for privacy if available
    let ipHash: string | null = null;
    let userAgent: string | null = null;

    if (request) {
      const forwarded = request.headers?.['x-forwarded-for'];
      const ip = forwarded
        ? String(Array.isArray(forwarded) ? forwarded[0] : forwarded)
            .split(',')[0]
            ?.trim()
        : ((request as unknown as { ip?: string }).ip ??
          request.socket?.remoteAddress ??
          undefined);
      if (ip) {
        const secret = CONFIG.EVIDENCE_HMAC_SECRET ?? 'access-log-default';
        ipHash = createHmac('sha256', secret).update(ip).digest('hex');
      }
      userAgent = (request.headers?.['user-agent'] as string | undefined) ?? null;
    }

    const log = await container.prisma.evidenceAccessLog.create({
      data: {
        evidenceId,
        guildId,
        userId,
        userTag,
        action,
        ipHash,
        userAgent,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    container.logger.debug(
      `[AccessLogService] Logged ${action} for evidence ${evidenceId} by ${userTag}`
    );

    return log;
  }

  /**
   * Get access log for an evidence item with pagination.
   */
  async getAccessLog(
    evidenceId: string,
    options: AccessLogOptions = {}
  ): Promise<{ logs: AccessLogEntry[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      container.prisma.evidenceAccessLog.findMany({
        where: { evidenceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      container.prisma.evidenceAccessLog.count({ where: { evidenceId } }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        evidenceId: log.evidenceId,
        guildId: log.guildId,
        userId: log.userId,
        userTag: log.userTag,
        action: log.action as AccessAction,
        ipHash: log.ipHash,
        userAgent: log.userAgent,
        metadata: (log.metadata as Record<string, unknown>) ?? {},
        createdAt: log.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get access log for all evidence in a guild.
   */
  async getGuildAccessLog(
    guildId: string,
    options: AccessLogOptions & { evidenceId?: string; userId?: string; action?: AccessAction } = {}
  ): Promise<{ logs: AccessLogEntry[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.EvidenceAccessLogWhereInput = { guildId };
    if (options.evidenceId) where.evidenceId = options.evidenceId;
    if (options.userId) where.userId = options.userId;
    if (options.action) where.action = options.action;

    const [logs, total] = await Promise.all([
      container.prisma.evidenceAccessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      container.prisma.evidenceAccessLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        evidenceId: log.evidenceId,
        guildId: log.guildId,
        userId: log.userId,
        userTag: log.userTag,
        action: log.action as AccessAction,
        ipHash: log.ipHash,
        userAgent: log.userAgent,
        metadata: (log.metadata as Record<string, unknown>) ?? {},
        createdAt: log.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const accessLogService = new AccessLogServiceClass();
