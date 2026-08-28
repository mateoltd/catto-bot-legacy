/**
 * Rank Card Data Service
 * Provides all data needed for generating rank cards (text and voice XP)
 */

import { container } from '@sapphire/framework';
import type { PrismaClient } from '@prisma/client';

export interface TextXPBreakdown {
  messageXP: number;
  voiceXP: number;
}

export interface VoiceXPBreakdown {
  totalVoiceXP: number;
  minutesInVoice: number;
}

export type ActivityChannel =
  | { state: 'available'; name: string }
  | { state: 'none'; name?: undefined }
  | { state: 'unavailable'; name?: undefined };

function activityChannel(hasActivity: boolean, name: string | null): ActivityChannel {
  if (name) return { state: 'available', name };
  return hasActivity ? { state: 'unavailable' } : { state: 'none' };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateRollingDayStreak(activityDates: Date[], now: Date = new Date()): number {
  const activeWindows = new Set<number>();
  for (const date of activityDates) {
    const age = now.getTime() - date.getTime();
    if (age >= 0) activeWindows.add(Math.floor(age / DAY_MS));
  }

  const windows = [...activeWindows].sort((a, b) => a - b);
  const firstWindow = windows[0];
  if (firstWindow === undefined || firstWindow > 1) return 0;

  let streak = 0;
  let expectedWindow = firstWindow;
  for (const window of windows) {
    if (window !== expectedWindow) break;
    streak++;
    expectedWindow++;
  }

  return streak;
}

export function calculateSessionOverlapMinutes(
  joinedAt: Date,
  leftAt: Date | null,
  windowStart: Date,
  now: Date
): number {
  const start = Math.max(joinedAt.getTime(), windowStart.getTime());
  const end = Math.min((leftAt ?? now).getTime(), now.getTime());
  return Math.max(0, Math.floor((end - start) / (60 * 1000)));
}

export interface ActivityData {
  channel: ActivityChannel;
  last7DaysXP: number;
  streak: number;
}

export interface VoiceActivityData {
  channel: ActivityChannel;
  last7DaysMinutes: number;
  streak: number;
}

export class RankCardDataService {
  constructor(private readonly prisma: PrismaClient) {}

  private async resolveChannelName(
    guildId: string,
    channelId: string,
    kind: 'text' | 'voice',
    storedName?: string
  ): Promise<string | null> {
    try {
      const guild =
        container.client.guilds.cache.get(guildId) ??
        (await container.client.guilds.fetch(guildId));
      const channel =
        guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
      const isExpectedKind =
        kind === 'voice'
          ? channel?.isVoiceBased()
          : channel?.isTextBased() && !channel.isVoiceBased();

      if (channel && isExpectedKind && 'name' in channel) {
        return channel.name;
      }
    } catch {
      // Deleted or inaccessible channels can still use the name captured with the XP event.
    }

    const historicalName = storedName?.trim();
    return historicalName || null;
  }

  /**
   * Get member join date formatted as "MMM YYYY"
   */
  async getMemberSince(guildId: string, userId: string): Promise<string> {
    const guild =
      container.client.guilds.cache.get(guildId) ?? (await container.client.guilds.fetch(guildId));
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
    const joinedAt = member.joinedAt;

    if (!joinedAt) {
      throw new Error(
        `Discord did not provide a join date for member ${userId} in guild ${guildId}`
      );
    }

    return joinedAt.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  /**
   * Get XP breakdown by source (text XP)
   */
  async getTextXPBreakdown(guildId: string, userId: string): Promise<TextXPBreakdown> {
    const [textXP, voiceXP] = await Promise.all([
      this.prisma.userXP.findUnique({
        where: { guildId_userId: { guildId, userId } },
        select: { xp: true },
      }),
      this.prisma.userVoiceXP.findUnique({
        where: { guildId_userId: { guildId, userId } },
        select: { xp: true },
      }),
    ]);

    return {
      messageXP: textXP?.xp ?? 0,
      voiceXP: voiceXP?.xp ?? 0,
    };
  }

  /**
   * Get activity data for user (text XP)
   */
  async getTextActivityData(guildId: string, userId: string): Promise<ActivityData> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const last30DaysEvents = await this.prisma.xPEventLog.findMany({
      where: {
        guildId,
        userId,
        createdAt: { gte: thirtyDaysAgo },
        eventType: 'AWARD',
        xpChange: { gt: 0 },
      },
      select: { xpChange: true, metadata: true, createdAt: true },
    });

    const last7DaysXP = last30DaysEvents
      .filter((event) => event.createdAt >= sevenDaysAgo)
      .reduce((sum, event) => sum + event.xpChange, 0);
    const channelCounts = new Map<string, number>();
    const channelNames = new Map<string, string>();
    for (const event of last30DaysEvents) {
      const metadata = event.metadata as {
        channelId?: string;
        channelName?: string;
      } | null;
      const channelId = metadata?.channelId;
      if (!channelId) continue;

      channelCounts.set(channelId, (channelCounts.get(channelId) || 0) + 1);
      if (metadata?.channelName) channelNames.set(channelId, metadata.channelName);
    }

    let resolvedChannel: string | null = null;
    const rankedChannels = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [channelId] of rankedChannels) {
      const channelName = await this.resolveChannelName(
        guildId,
        channelId,
        'text',
        channelNames.get(channelId)
      );
      if (channelName) {
        resolvedChannel = `#${channelName}`;
        break;
      }
    }

    return {
      channel: activityChannel(last30DaysEvents.length > 0, resolvedChannel),
      last7DaysXP,
      streak: await this.calculateTextStreak(guildId, userId),
    };
  }

  /**
   * Calculate user's daily activity streak (text XP)
   */
  async calculateTextStreak(guildId: string, userId: string): Promise<number> {
    const events = await this.prisma.xPEventLog.findMany({
      where: {
        guildId,
        userId,
        eventType: 'AWARD',
        xpChange: { gt: 0 },
      },
      select: { createdAt: true },
    });

    return calculateRollingDayStreak(events.map((event) => event.createdAt));
  }

  /** Get authoritative voice totals without estimating a legacy activity breakdown. */
  async getVoiceXPBreakdown(guildId: string, userId: string): Promise<VoiceXPBreakdown> {
    const userVoiceXP = await this.prisma.userVoiceXP.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { xp: true, minutesInVoice: true },
    });

    return {
      totalVoiceXP: userVoiceXP?.xp ?? 0,
      minutesInVoice: userVoiceXP?.minutesInVoice ?? 0,
    };
  }

  /**
   * Get voice activity data for user
   */
  async getVoiceActivityData(guildId: string, userId: string): Promise<VoiceActivityData> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [sessions, recentEvents] = await Promise.all([
      this.prisma.voiceSession.findMany({
        where: {
          guildId,
          userId,
          joinedAt: { lte: now },
          OR: [{ leftAt: null }, { leftAt: { gte: thirtyDaysAgo } }],
        },
        select: { channelId: true, leftAt: true, joinedAt: true },
      }),
      this.prisma.voiceXPEventLog.findMany({
        where: {
          guildId,
          userId,
          eventType: 'AWARD',
          xpChange: { gt: 0 },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { metadata: true },
      }),
    ]);

    const channelNames = new Map<string, string>();
    for (const event of recentEvents) {
      const metadata = event.metadata as {
        channelId?: string;
        channelName?: string;
      } | null;
      if (metadata?.channelId && metadata.channelName) {
        channelNames.set(metadata.channelId, metadata.channelName);
      }
    }

    let last7DaysMinutes = 0;
    let last30DaysMinutes = 0;
    const channelCounts = new Map<string, number>();
    for (const session of sessions) {
      const sevenDayMinutes = calculateSessionOverlapMinutes(
        session.joinedAt,
        session.leftAt,
        sevenDaysAgo,
        now
      );
      const thirtyDayMinutes = calculateSessionOverlapMinutes(
        session.joinedAt,
        session.leftAt,
        thirtyDaysAgo,
        now
      );

      last7DaysMinutes += sevenDayMinutes;
      last30DaysMinutes += thirtyDayMinutes;
      if (thirtyDayMinutes > 0) {
        channelCounts.set(
          session.channelId,
          (channelCounts.get(session.channelId) || 0) + thirtyDayMinutes
        );
      }
    }

    let resolvedChannel: string | null = null;
    const rankedChannels = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [channelId] of rankedChannels) {
      const channelName = await this.resolveChannelName(
        guildId,
        channelId,
        'voice',
        channelNames.get(channelId)
      );
      if (channelName) {
        resolvedChannel = channelName;
        break;
      }
    }

    return {
      channel: activityChannel(last30DaysMinutes > 0, resolvedChannel),
      last7DaysMinutes,
      streak: await this.calculateVoiceStreak(guildId, userId),
    };
  }

  /**
   * Calculate user's daily voice activity streak
   */
  async calculateVoiceStreak(guildId: string, userId: string): Promise<number> {
    const events = await this.prisma.voiceXPEventLog.findMany({
      where: {
        guildId,
        userId,
        eventType: 'AWARD',
        xpChange: { gt: 0 },
      },
      select: { createdAt: true },
    });

    return calculateRollingDayStreak(events.map((event) => event.createdAt));
  }
}
