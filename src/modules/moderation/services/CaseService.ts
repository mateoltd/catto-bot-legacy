import { container } from '@sapphire/framework';
import { CaseStatus, Prisma } from '@prisma/client';
import type { GuildId, CaseNumber, ModCaseUpdateInput, CaseEvidence } from '../domain/types.js';
import { asCaseNumber } from '../domain/types.js';
import { publish, ModEventChannels } from '#lib/redis.js';

/**
 * Service result type for case operations
 */
export interface CaseResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
}

/**
 * Extended case data returned from queries
 */
export interface ExtendedCaseData {
  id: string;
  caseNumber: CaseNumber;
  guildId: string;
  action: string;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string | null;
  duration: number | null;
  status: CaseStatus;
  evidence: CaseEvidence | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

/**
 * CaseService - Extended case management operations
 */
export class CaseService {
  /**
   * Edit a case's reason
   */
  async editReason(guildId: GuildId, caseNumber: number, reason: string): Promise<CaseResult> {
    try {
      const modCase = await container.prisma.modCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
      });

      if (!modCase) {
        return { success: false, error: 'Case not found' };
      }

      await container.prisma.modCase.update({
        where: { guildId_caseNumber: { guildId, caseNumber } },
        data: { reason },
      });

      await publish(ModEventChannels.MOD_EVENTS(guildId), {
        type: 'case:updated',
        guildId,
        caseNumber,
        data: { field: 'reason' },
      }).catch(() => {});

      return { success: true, caseNumber: asCaseNumber(caseNumber) };
    } catch (error) {
      container.logger.error('Failed to edit case reason:', error);
      return { success: false, error: 'Failed to edit case' };
    }
  }

  /**
   * Link evidence to a case (message links, attachments)
   */
  async linkEvidence(
    guildId: GuildId,
    caseNumber: number,
    evidence: CaseEvidence
  ): Promise<CaseResult> {
    try {
      const modCase = await container.prisma.modCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
      });

      if (!modCase) {
        return { success: false, error: 'Case not found' };
      }

      // Merge with existing evidence
      const existingEvidence = (modCase.evidence as CaseEvidence) ?? {};
      const mergedEvidence: CaseEvidence = {
        messageLinks: [...(existingEvidence.messageLinks ?? []), ...(evidence.messageLinks ?? [])],
        attachments: [...(existingEvidence.attachments ?? []), ...(evidence.attachments ?? [])],
        notes: evidence.notes ?? existingEvidence.notes,
      };

      await container.prisma.modCase.update({
        where: { guildId_caseNumber: { guildId, caseNumber } },
        data: { evidence: mergedEvidence as unknown as Prisma.InputJsonValue },
      });

      return { success: true, caseNumber: asCaseNumber(caseNumber) };
    } catch (error) {
      container.logger.error('Failed to link evidence:', error);
      return { success: false, error: 'Failed to link evidence' };
    }
  }

  /**
   * Close a case with optional status
   */
  async closeCase(
    guildId: GuildId,
    caseNumber: number,
    status: CaseStatus = CaseStatus.CLOSED
  ): Promise<CaseResult> {
    try {
      const modCase = await container.prisma.modCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
      });

      if (!modCase) {
        return { success: false, error: 'Case not found' };
      }

      if (modCase.status !== CaseStatus.OPEN) {
        return { success: false, error: 'Case is already closed or void' };
      }

      await container.prisma.modCase.update({
        where: { guildId_caseNumber: { guildId, caseNumber } },
        data: { status },
      });

      await publish(ModEventChannels.MOD_EVENTS(guildId), {
        type: 'case:closed',
        guildId,
        caseNumber,
        data: { status },
      }).catch(() => {});

      return { success: true, caseNumber: asCaseNumber(caseNumber) };
    } catch (error) {
      container.logger.error('Failed to close case:', error);
      return { success: false, error: 'Failed to close case' };
    }
  }

  /**
   * Void a case (marks it as invalid/reversed)
   */
  async voidCase(guildId: GuildId, caseNumber: number): Promise<CaseResult> {
    return this.closeCase(guildId, caseNumber, CaseStatus.VOID);
  }

  /**
   * Reopen a closed case
   */
  async reopenCase(guildId: GuildId, caseNumber: number): Promise<CaseResult> {
    try {
      const modCase = await container.prisma.modCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
      });

      if (!modCase) {
        return { success: false, error: 'Case not found' };
      }

      if (modCase.status === CaseStatus.OPEN) {
        return { success: false, error: 'Case is already open' };
      }

      await container.prisma.modCase.update({
        where: { guildId_caseNumber: { guildId, caseNumber } },
        data: { status: CaseStatus.OPEN },
      });

      await publish(ModEventChannels.MOD_EVENTS(guildId), {
        type: 'case:updated',
        guildId,
        caseNumber,
        data: { status: 'OPEN' },
      }).catch(() => {});

      return { success: true, caseNumber: asCaseNumber(caseNumber) };
    } catch (error) {
      container.logger.error('Failed to reopen case:', error);
      return { success: false, error: 'Failed to reopen case' };
    }
  }

  /**
   * Get extended case details
   */
  async getExtendedCase(guildId: GuildId, caseNumber: number): Promise<ExtendedCaseData | null> {
    const modCase = await container.prisma.modCase.findUnique({
      where: { guildId_caseNumber: { guildId, caseNumber } },
    });

    if (!modCase) return null;

    return {
      id: modCase.id,
      caseNumber: asCaseNumber(modCase.caseNumber),
      guildId: modCase.guildId,
      action: modCase.action,
      targetId: modCase.targetId,
      targetTag: modCase.targetTag,
      moderatorId: modCase.moderatorId,
      moderatorTag: modCase.moderatorTag,
      reason: modCase.reason,
      duration: modCase.duration,
      status: modCase.status,
      evidence: modCase.evidence as CaseEvidence | null,
      createdAt: modCase.createdAt,
      updatedAt: modCase.updatedAt,
      expiresAt: modCase.expiresAt,
    };
  }

  /**
   * Get cases by status
   */
  async getCasesByStatus(guildId: GuildId, status: CaseStatus): Promise<ExtendedCaseData[]> {
    const cases = await container.prisma.modCase.findMany({
      where: { guildId, status },
      orderBy: { createdAt: 'desc' },
    });

    return cases.map((modCase) => ({
      id: modCase.id,
      caseNumber: asCaseNumber(modCase.caseNumber),
      guildId: modCase.guildId,
      action: modCase.action,
      targetId: modCase.targetId,
      targetTag: modCase.targetTag,
      moderatorId: modCase.moderatorId,
      moderatorTag: modCase.moderatorTag,
      reason: modCase.reason,
      duration: modCase.duration,
      status: modCase.status,
      evidence: modCase.evidence as CaseEvidence | null,
      createdAt: modCase.createdAt,
      updatedAt: modCase.updatedAt,
      expiresAt: modCase.expiresAt,
    }));
  }

  /**
   * Get open cases count for a guild
   */
  async getOpenCasesCount(guildId: GuildId): Promise<number> {
    return container.prisma.modCase.count({
      where: { guildId, status: CaseStatus.OPEN },
    });
  }

  /**
   * Update case with arbitrary fields
   */
  async updateCase(
    guildId: GuildId,
    caseNumber: number,
    input: ModCaseUpdateInput
  ): Promise<CaseResult> {
    try {
      const modCase = await container.prisma.modCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
      });

      if (!modCase) {
        return { success: false, error: 'Case not found' };
      }

      await container.prisma.modCase.update({
        where: { guildId_caseNumber: { guildId, caseNumber } },
        data: {
          ...(input.reason !== undefined && { reason: input.reason }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.evidence !== undefined && {
            evidence: input.evidence as unknown as Prisma.InputJsonValue,
          }),
        },
      });

      await publish(ModEventChannels.MOD_EVENTS(guildId), {
        type: 'case:updated',
        guildId,
        caseNumber,
      }).catch(() => {});

      return { success: true, caseNumber: asCaseNumber(caseNumber) };
    } catch (error) {
      container.logger.error('Failed to update case:', error);
      return { success: false, error: 'Failed to update case' };
    }
  }
}

// Export singleton instance
export const caseService = new CaseService();
