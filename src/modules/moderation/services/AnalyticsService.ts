/**
 * AnalyticsService - Evidence analytics and statistics
 *
 * Aggregates evidence stats with Redis caching (15min TTL).
 */

import { container } from '@sapphire/framework';
import { getJson, setJson } from '#lib/cache/typedCache.js';
import { z } from 'zod';

const ANALYTICS_CACHE_TTL = 900; // 15 minutes

// Schema for analytics data
const analyticsSchema = z.object({
  volumeOverTime: z.array(
    z.object({
      date: z.string(),
      count: z.number(),
    })
  ),
  byType: z.record(z.string(), z.number()),
  byStatus: z.record(z.string(), z.number()),
  storageUsage: z.object({
    totalBytes: z.number(),
    count: z.number(),
  }),
  topUploaders: z.array(
    z.object({
      userId: z.string(),
      userTag: z.string(),
      count: z.number(),
    })
  ),
  flaggedRate: z.number(),
  period: z.string(),
  cachedAt: z.number(),
});

export type EvidenceAnalytics = z.infer<typeof analyticsSchema>;

export type AnalyticsPeriod = '7d' | '30d' | '90d';

class AnalyticsServiceClass {
  /**
   * Get evidence analytics for a guild.
   */
  async getAnalytics(guildId: string, period: AnalyticsPeriod = '30d'): Promise<EvidenceAnalytics> {
    const cacheKey = `analytics:evidence:${guildId}:${period}`;

    // Check cache
    const cached = await getJson(cacheKey, analyticsSchema);
    if (cached) {
      return cached;
    }

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Run queries in parallel
    const [volumeOverTime, byType, byStatus, storageUsage, topUploaders, flaggedCount, totalCount] =
      await Promise.all([
        this.getVolumeOverTime(guildId, startDate),
        this.getByType(guildId, startDate),
        this.getByStatus(guildId, startDate),
        this.getStorageUsage(guildId, startDate),
        this.getTopUploaders(guildId, startDate),
        container.prisma.evidence.count({
          where: { guildId, status: 'FLAGGED', createdAt: { gte: startDate } },
        }),
        container.prisma.evidence.count({
          where: { guildId, createdAt: { gte: startDate } },
        }),
      ]);

    const analytics: EvidenceAnalytics = {
      volumeOverTime,
      byType,
      byStatus,
      storageUsage,
      topUploaders,
      flaggedRate: totalCount > 0 ? flaggedCount / totalCount : 0,
      period,
      cachedAt: Date.now(),
    };

    // Cache result
    await setJson(cacheKey, analyticsSchema, analytics, ANALYTICS_CACHE_TTL);

    return analytics;
  }

  /**
   * Get evidence volume over time (daily counts).
   */
  private async getVolumeOverTime(
    guildId: string,
    startDate: Date
  ): Promise<Array<{ date: string; count: number }>> {
    // Use raw query for date grouping
    const result = await container.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt" AT TIME ZONE 'UTC') as date, COUNT(*) as count
      FROM "evidence"
      WHERE "guildId" = ${guildId} AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt" AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `;

    // Fill in missing dates with 0
    const dateMap = new Map<string, number>();
    for (const row of result) {
      const dateStr = row.date.toISOString().split('T')[0]!;
      dateMap.set(dateStr, Number(row.count));
    }

    const volumeOverTime: Array<{ date: string; count: number }> = [];
    const current = new Date(startDate);
    const now = new Date();

    while (current <= now) {
      const dateStr = current.toISOString().split('T')[0]!;
      volumeOverTime.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return volumeOverTime;
  }

  /**
   * Get evidence count by type.
   */
  private async getByType(guildId: string, startDate: Date): Promise<Record<string, number>> {
    const result = await container.prisma.evidence.groupBy({
      by: ['type'],
      where: { guildId, createdAt: { gte: startDate } },
      _count: { type: true },
    });

    return result.reduce(
      (acc, row) => {
        acc[row.type] = row._count.type;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Get evidence count by status.
   */
  private async getByStatus(guildId: string, startDate: Date): Promise<Record<string, number>> {
    const result = await container.prisma.evidence.groupBy({
      by: ['status'],
      where: { guildId, createdAt: { gte: startDate } },
      _count: { status: true },
    });

    return result.reduce(
      (acc, row) => {
        acc[row.status] = row._count.status;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Get total storage usage.
   */
  private async getStorageUsage(
    guildId: string,
    startDate: Date
  ): Promise<{ totalBytes: number; count: number }> {
    const result = await container.prisma.evidence.aggregate({
      where: { guildId, createdAt: { gte: startDate }, sizeBytes: { not: null } },
      _sum: { sizeBytes: true },
      _count: { sizeBytes: true },
    });

    return {
      totalBytes: result._sum.sizeBytes ?? 0,
      count: result._count.sizeBytes,
    };
  }

  /**
   * Get top uploaders by evidence count.
   */
  private async getTopUploaders(
    guildId: string,
    startDate: Date
  ): Promise<Array<{ userId: string; userTag: string; count: number }>> {
    const result = await container.prisma.evidence.groupBy({
      by: ['uploadedById'],
      where: { guildId, createdAt: { gte: startDate } },
      _count: { uploadedById: true },
      orderBy: { _count: { uploadedById: 'desc' } },
      take: 10,
    });

    // Resolve latest tag for each user
    const userIds = result.map((row) => row.uploadedById);
    const latestTags = await Promise.all(
      userIds.map(async (userId) => {
        const latest = await container.prisma.evidence.findFirst({
          where: { guildId, uploadedById: userId },
          orderBy: { createdAt: 'desc' },
          select: { uploadedByTag: true },
        });
        return { userId, tag: latest?.uploadedByTag ?? userId };
      })
    );
    const tagMap = new Map(latestTags.map((t) => [t.userId, t.tag]));

    return result.map((row) => ({
      userId: row.uploadedById,
      userTag: tagMap.get(row.uploadedById) ?? row.uploadedById,
      count: row._count.uploadedById,
    }));
  }

  /**
   * Get case analytics for a guild.
   */
  async getCaseAnalytics(
    guildId: string,
    period: AnalyticsPeriod = '30d'
  ): Promise<{
    volumeOverTime: Array<{ date: string; count: number }>;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
    assignmentRate: number;
  }> {
    const cacheKey = `analytics:cases:${guildId}:${period}`;

    // Check cache
    const cached = await getJson(
      cacheKey,
      z.object({
        volumeOverTime: z.array(z.object({ date: z.string(), count: z.number() })),
        byAction: z.record(z.string(), z.number()),
        byStatus: z.record(z.string(), z.number()),
        assignmentRate: z.number(),
      })
    );
    if (cached) return cached;

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [volumeResult, byAction, byStatus, assignedCount, totalCount] = await Promise.all([
      container.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE("createdAt" AT TIME ZONE 'UTC') as date, COUNT(*) as count
        FROM "mod_cases"
        WHERE "guildId" = ${guildId} AND "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt" AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,
      container.prisma.modCase.groupBy({
        by: ['action'],
        where: { guildId, createdAt: { gte: startDate } },
        _count: { action: true },
      }),
      container.prisma.modCase.groupBy({
        by: ['status'],
        where: { guildId, createdAt: { gte: startDate } },
        _count: { status: true },
      }),
      container.prisma.modCase.count({
        where: { guildId, assignedToId: { not: null }, createdAt: { gte: startDate } },
      }),
      container.prisma.modCase.count({
        where: { guildId, createdAt: { gte: startDate } },
      }),
    ]);

    // Fill in missing dates
    const dateMap = new Map<string, number>();
    for (const row of volumeResult) {
      const dateStr = row.date.toISOString().split('T')[0]!;
      dateMap.set(dateStr, Number(row.count));
    }

    const volumeOverTime: Array<{ date: string; count: number }> = [];
    const current = new Date(startDate);
    const now = new Date();

    while (current <= now) {
      const dateStr = current.toISOString().split('T')[0]!;
      volumeOverTime.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }

    const caseAnalytics = {
      volumeOverTime,
      byAction: byAction.reduce(
        (acc, row) => {
          acc[row.action] = row._count.action;
          return acc;
        },
        {} as Record<string, number>
      ),
      byStatus: byStatus.reduce(
        (acc, row) => {
          acc[row.status] = row._count.status;
          return acc;
        },
        {} as Record<string, number>
      ),
      assignmentRate: totalCount > 0 ? assignedCount / totalCount : 0,
    };

    // Cache result
    await setJson(
      cacheKey,
      z.object({
        volumeOverTime: z.array(z.object({ date: z.string(), count: z.number() })),
        byAction: z.record(z.string(), z.number()),
        byStatus: z.record(z.string(), z.number()),
        assignmentRate: z.number(),
      }),
      caseAnalytics,
      ANALYTICS_CACHE_TTL
    );

    return caseAnalytics;
  }
}

export const analyticsService = new AnalyticsServiceClass();
