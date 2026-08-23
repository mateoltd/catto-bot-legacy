/**
 * Keyword Queue Service
 *
 * Manages the queue of keywords extracted from flagged channel names
 * (Discovery revocations, manual reports, auto-detection).
 * Supports review workflow: pending → approved/denied/ignored.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { KeywordApprovalStatus } from '@prisma/client';
import { NameNormalizationService } from './name-normalization.service.js';

/**
 * Source of keyword detection
 */
export enum KeywordSource {
  DISCOVERY_REVOCATION = 'DISCOVERY_REVOCATION',
  MANUAL_REPORT = 'MANUAL_REPORT',
  AUTO_DETECTED = 'AUTO_DETECTED',
}

/**
 * Context for adding a keyword to the queue
 */
export interface AddKeywordContext {
  guildId: string;
  keyword: string;
  source: KeywordSource;
  contextSnippet?: string;
  channelId?: string;
  userId?: string;
}

/**
 * Keyword queue entry with metadata
 */
export interface KeywordQueueEntry {
  id: string;
  guildId: string;
  keyword: string;
  normalizedKeyword: string;
  source: string;
  contextSnippet: string | null;
  channelId: string | null;
  userId: string | null;
  status: KeywordApprovalStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  occurrences: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Filters for querying keywords
 */
export interface KeywordQueueFilters {
  status?: KeywordApprovalStatus;
  source?: KeywordSource;
  minOccurrences?: number;
  limit?: number;
  offset?: number;
}

/**
 * Result of keyword review action
 */
export interface KeywordReviewResult {
  id: string;
  keyword: string;
  status: KeywordApprovalStatus;
  patternCreated?: boolean;
  patternId?: string;
}

export class KeywordQueueService {
  private normalizationService: NameNormalizationService;

  constructor(private prisma: PrismaClient) {
    this.normalizationService = new NameNormalizationService();
  }

  /**
   * Add a keyword to the queue (or increment occurrence if exists)
   */
  async addKeyword(context: AddKeywordContext): Promise<KeywordQueueEntry> {
    // Normalize the keyword for deduplication
    const normalized = this.normalizationService.normalize(context.keyword);
    const normalizedKeyword = normalized.normalized;

    // Check if keyword already exists for this guild
    const existing = await this.prisma.tempVoiceKeywordQueue.findUnique({
      where: {
        guildId_normalizedKeyword: {
          guildId: context.guildId,
          normalizedKeyword: normalizedKeyword,
        },
      },
    });

    if (existing) {
      // Increment occurrence count and update lastSeenAt
      return await this.prisma.tempVoiceKeywordQueue.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: new Date(),
          // Update context snippet if provided (keep most recent)
          contextSnippet: context.contextSnippet ?? existing.contextSnippet,
          channelId: context.channelId ?? existing.channelId,
          userId: context.userId ?? existing.userId,
        },
      });
    }

    // Create new entry
    return await this.prisma.tempVoiceKeywordQueue.create({
      data: {
        guildId: context.guildId,
        keyword: context.keyword,
        normalizedKeyword: normalizedKeyword,
        source: context.source,
        contextSnippet: context.contextSnippet,
        channelId: context.channelId,
        userId: context.userId,
        status: KeywordApprovalStatus.PENDING,
        occurrences: 1,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Add multiple keywords at once (batch operation)
   */
  async addKeywords(keywords: AddKeywordContext[]): Promise<KeywordQueueEntry[]> {
    const results: KeywordQueueEntry[] = [];

    for (const context of keywords) {
      try {
        const entry = await this.addKeyword(context);
        results.push(entry);
      } catch (error) {
        console.error(`Failed to add keyword "${context.keyword}":`, error);
        // Continue with other keywords
      }
    }

    return results;
  }

  /**
   * Get pending keywords for a guild
   */
  async getPendingKeywords(
    guildId: string,
    filters: KeywordQueueFilters = {}
  ): Promise<KeywordQueueEntry[]> {
    const where: Prisma.TempVoiceKeywordQueueWhereInput = {
      guildId,
      status: filters.status ?? KeywordApprovalStatus.PENDING,
    };

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.minOccurrences) {
      where.occurrences = { gte: filters.minOccurrences };
    }

    return await this.prisma.tempVoiceKeywordQueue.findMany({
      where,
      orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  /**
   * Get all keywords for a guild (any status)
   */
  async getAllKeywords(
    guildId: string,
    filters: KeywordQueueFilters = {}
  ): Promise<KeywordQueueEntry[]> {
    const where: Prisma.TempVoiceKeywordQueueWhereInput = { guildId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.minOccurrences) {
      where.occurrences = { gte: filters.minOccurrences };
    }

    return await this.prisma.tempVoiceKeywordQueue.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });
  }

  /**
   * Get a single keyword entry by ID
   */
  async getKeywordById(id: string): Promise<KeywordQueueEntry | null> {
    return await this.prisma.tempVoiceKeywordQueue.findUnique({
      where: { id },
    });
  }

  /**
   * Approve a keyword - adds it to the moderation patterns
   */
  async approveKeyword(
    id: string,
    reviewerId: string,
    reviewNote?: string
  ): Promise<KeywordReviewResult> {
    const entry = await this.getKeywordById(id);
    if (!entry) {
      throw new Error(`Keyword with ID ${id} not found`);
    }

    if (entry.status !== KeywordApprovalStatus.PENDING) {
      throw new Error(`Keyword is not pending (current status: ${entry.status})`);
    }

    // Update keyword status
    const updated = await this.prisma.tempVoiceKeywordQueue.update({
      where: { id },
      data: {
        status: KeywordApprovalStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    // Create moderation pattern from approved keyword
    const pattern = await this.createPatternFromKeyword(entry);

    return {
      id: updated.id,
      keyword: updated.keyword,
      status: updated.status,
      patternCreated: !!pattern,
      patternId: pattern?.id,
    };
  }

  /**
   * Deny a keyword - marks it as denied without adding to patterns
   */
  async denyKeyword(
    id: string,
    reviewerId: string,
    reviewNote?: string
  ): Promise<KeywordReviewResult> {
    const entry = await this.getKeywordById(id);
    if (!entry) {
      throw new Error(`Keyword with ID ${id} not found`);
    }

    if (entry.status !== KeywordApprovalStatus.PENDING) {
      throw new Error(`Keyword is not pending (current status: ${entry.status})`);
    }

    const updated = await this.prisma.tempVoiceKeywordQueue.update({
      where: { id },
      data: {
        status: KeywordApprovalStatus.DENIED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    return {
      id: updated.id,
      keyword: updated.keyword,
      status: updated.status,
      patternCreated: false,
    };
  }

  /**
   * Ignore a keyword - dismisses it without action
   */
  async ignoreKeyword(
    id: string,
    reviewerId: string,
    reviewNote?: string
  ): Promise<KeywordReviewResult> {
    const entry = await this.getKeywordById(id);
    if (!entry) {
      throw new Error(`Keyword with ID ${id} not found`);
    }

    const updated = await this.prisma.tempVoiceKeywordQueue.update({
      where: { id },
      data: {
        status: KeywordApprovalStatus.IGNORED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    return {
      id: updated.id,
      keyword: updated.keyword,
      status: updated.status,
      patternCreated: false,
    };
  }

  /**
   * Batch approve multiple keywords
   */
  async approveKeywords(
    ids: string[],
    reviewerId: string,
    reviewNote?: string
  ): Promise<KeywordReviewResult[]> {
    const results: KeywordReviewResult[] = [];

    for (const id of ids) {
      try {
        const result = await this.approveKeyword(id, reviewerId, reviewNote);
        results.push(result);
      } catch (error) {
        console.error(`Failed to approve keyword ${id}:`, error);
      }
    }

    return results;
  }

  /**
   * Batch deny multiple keywords
   */
  async denyKeywords(
    ids: string[],
    reviewerId: string,
    reviewNote?: string
  ): Promise<KeywordReviewResult[]> {
    const results: KeywordReviewResult[] = [];

    for (const id of ids) {
      try {
        const result = await this.denyKeyword(id, reviewerId, reviewNote);
        results.push(result);
      } catch (error) {
        console.error(`Failed to deny keyword ${id}:`, error);
      }
    }

    return results;
  }

  /**
   * Get statistics for keyword queue
   */
  async getQueueStats(guildId: string): Promise<{
    pending: number;
    approved: number;
    denied: number;
    ignored: number;
    total: number;
  }> {
    const [pending, approved, denied, ignored, total] = await Promise.all([
      this.prisma.tempVoiceKeywordQueue.count({
        where: { guildId, status: KeywordApprovalStatus.PENDING },
      }),
      this.prisma.tempVoiceKeywordQueue.count({
        where: { guildId, status: KeywordApprovalStatus.APPROVED },
      }),
      this.prisma.tempVoiceKeywordQueue.count({
        where: { guildId, status: KeywordApprovalStatus.DENIED },
      }),
      this.prisma.tempVoiceKeywordQueue.count({
        where: { guildId, status: KeywordApprovalStatus.IGNORED },
      }),
      this.prisma.tempVoiceKeywordQueue.count({ where: { guildId } }),
    ]);

    return { pending, approved, denied, ignored, total };
  }

  /**
   * Create a moderation pattern from an approved keyword
   */
  private async createPatternFromKeyword(entry: KeywordQueueEntry): Promise<{ id: string } | null> {
    try {
      // Create word boundary pattern for exact keyword match
      const pattern = `\\b${this.escapeRegex(entry.normalizedKeyword)}\\b`;

      const moderationPattern = await this.prisma.tempVoiceModerationPattern.create({
        data: {
          pattern,
          patternType: 'USER_REPORTED',
          description: `User-reported keyword from ${entry.source}: "${entry.keyword}"`,
          severity: 7, // High severity for user-reported content
          enabled: true,
          caseInsensitive: true,
        },
      });

      console.log(
        `[Keyword Queue] Created pattern ${moderationPattern.id} for keyword: ${entry.keyword}`
      );

      return { id: moderationPattern.id };
    } catch (error) {
      console.error(`Failed to create pattern from keyword "${entry.keyword}":`, error);
      return null;
    }
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Delete old reviewed keywords (cleanup)
   */
  async cleanupOldKeywords(guildId: string, daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.tempVoiceKeywordQueue.deleteMany({
      where: {
        guildId,
        status: { not: KeywordApprovalStatus.PENDING },
        reviewedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}
