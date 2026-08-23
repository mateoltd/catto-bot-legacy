/**
 * UserProfileService - Aggregates user moderation data
 *
 * Provides a comprehensive view of a user's moderation history
 * including cases, evidence, notes, and flags.
 */

import { container } from '@sapphire/framework';
import type { ModAction, EvidenceType, CaseStatus } from '@prisma/client';

export interface UserModProfile {
  userId: string;
  guildId: string;
  targetTag: string | null;
  cases: {
    total: number;
    byAction: Partial<Record<ModAction, number>>;
    byStatus: Partial<Record<CaseStatus, number>>;
    recent: Array<{
      id: string;
      caseNumber: number;
      action: ModAction;
      reason: string | null;
      moderatorTag: string;
      status: CaseStatus;
      createdAt: Date;
    }>;
  };
  evidence: {
    total: number;
    byType: Partial<Record<EvidenceType, number>>;
  };
  notes: {
    total: number;
    recent: Array<{
      id: string;
      note: string;
      createdById: string;
      tags: string[];
      createdAt: Date;
    }>;
  };
  flags: Array<{
    id: string;
    flag: string;
    reason: string | null;
    createdAt: Date;
    expiresAt: Date | null;
    active: boolean;
  }>;
  firstSeen: Date | null;
  lastAction: Date | null;
  // avatarUrl and username are added by the route handler (from Discord API)
  // not by the service itself (which only queries the DB)
}

class UserProfileServiceClass {
  /**
   * Get a comprehensive moderation profile for a user.
   */
  async getUserProfile(guildId: string, userId: string): Promise<UserModProfile> {
    const [
      casesData,
      casesByAction,
      casesByStatus,
      recentCases,
      evidenceCount,
      evidenceByType,
      notesCount,
      recentNotes,
      flags,
      firstCase,
      lastCase,
    ] = await Promise.all([
      // Total cases
      container.prisma.modCase.count({
        where: { guildId, targetId: userId },
      }),
      // Cases by action
      container.prisma.modCase.groupBy({
        by: ['action'],
        where: { guildId, targetId: userId },
        _count: { action: true },
      }),
      // Cases by status
      container.prisma.modCase.groupBy({
        by: ['status'],
        where: { guildId, targetId: userId },
        _count: { status: true },
      }),
      // Recent cases (including targetTag for display)
      container.prisma.modCase.findMany({
        where: { guildId, targetId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          caseNumber: true,
          action: true,
          reason: true,
          moderatorTag: true,
          targetTag: true,
          status: true,
          createdAt: true,
        },
      }),
      // Total evidence (across all cases for this user)
      container.prisma.evidence.count({
        where: {
          guildId,
          case: { targetId: userId },
        },
      }),
      // Evidence by type
      container.prisma.evidence.groupBy({
        by: ['type'],
        where: {
          guildId,
          case: { targetId: userId },
        },
        _count: { type: true },
      }),
      // Total notes
      container.prisma.userModNote.count({
        where: { guildId, userId },
      }),
      // Recent notes
      container.prisma.userModNote.findMany({
        where: { guildId, userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          note: true,
          createdById: true,
          tags: true,
          createdAt: true,
        },
      }),
      // Active flags
      container.prisma.userFlag.findMany({
        where: { guildId, userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          flag: true,
          reason: true,
          createdAt: true,
          expiresAt: true,
          active: true,
        },
      }),
      // First case
      container.prisma.modCase.findFirst({
        where: { guildId, targetId: userId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      // Last case
      container.prisma.modCase.findFirst({
        where: { guildId, targetId: userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      userId,
      guildId,
      targetTag: recentCases[0]?.targetTag ?? null,
      cases: {
        total: casesData,
        byAction: casesByAction.reduce(
          (acc, row) => {
            acc[row.action] = row._count.action;
            return acc;
          },
          {} as Partial<Record<ModAction, number>>
        ),
        byStatus: casesByStatus.reduce(
          (acc, row) => {
            acc[row.status] = row._count.status;
            return acc;
          },
          {} as Partial<Record<CaseStatus, number>>
        ),
        recent: recentCases,
      },
      evidence: {
        total: evidenceCount,
        byType: evidenceByType.reduce(
          (acc, row) => {
            acc[row.type] = row._count.type;
            return acc;
          },
          {} as Partial<Record<EvidenceType, number>>
        ),
      },
      notes: {
        total: notesCount,
        recent: recentNotes,
      },
      flags,
      firstSeen: firstCase?.createdAt ?? null,
      lastAction: lastCase?.createdAt ?? null,
    };
  }

  /**
   * Get a quick summary for a user (lighter weight than full profile).
   */
  async getUserSummary(
    guildId: string,
    userId: string
  ): Promise<{
    totalCases: number;
    activeFlags: number;
    recentAction: string | null;
    lastActionAt: Date | null;
  }> {
    const [totalCases, activeFlags, lastCase] = await Promise.all([
      container.prisma.modCase.count({
        where: { guildId, targetId: userId },
      }),
      container.prisma.userFlag.count({
        where: { guildId, userId, active: true },
      }),
      container.prisma.modCase.findFirst({
        where: { guildId, targetId: userId },
        orderBy: { createdAt: 'desc' },
        select: { action: true, createdAt: true },
      }),
    ]);

    return {
      totalCases,
      activeFlags,
      recentAction: lastCase?.action ?? null,
      lastActionAt: lastCase?.createdAt ?? null,
    };
  }
}

export const userProfileService = new UserProfileServiceClass();
