/**
 * Unit tests for Keyword Queue Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeywordQueueService, KeywordSource } from '../../../src/modules/temp-voice/services/moderation/keyword-queue.service.js';

// Mock @prisma/client before any imports
vi.mock('@prisma/client', () => ({
  KeywordApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    DENIED: 'DENIED',
    IGNORED: 'IGNORED',
  },
  Prisma: {
    TempVoiceKeywordQueueWhereInput: {},
  },
}));


// Local enum for testing
const KeywordApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  IGNORED: 'IGNORED',
} as const;

// Mock PrismaClient
const mockPrisma = {
  tempVoiceKeywordQueue: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  tempVoiceModerationPattern: {
    create: vi.fn(),
  },
} as any;

describe('KeywordQueueService', () => {
  let service: KeywordQueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    service = new KeywordQueueService(mockPrisma);
  });

  describe('addKeyword', () => {
    it('should create a new keyword entry', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(null);
      mockPrisma.tempVoiceKeywordQueue.create.mockResolvedValue({
        id: 'keyword-1',
        guildId: 'guild-123',
        keyword: 'BadWord',
        normalizedKeyword: 'badword',
        source: KeywordSource.MANUAL_REPORT,
        contextSnippet: 'Test channel name',
        channelId: 'channel-1',
        userId: 'user-1',
        status: KeywordApprovalStatus.PENDING,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        occurrences: 1,
        lastSeenAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const result = await service.addKeyword({
        guildId: 'guild-123',
        keyword: 'BadWord',
        source: KeywordSource.MANUAL_REPORT,
        contextSnippet: 'Test channel name',
        channelId: 'channel-1',
        userId: 'user-1',
      });

      expect(result.keyword).toBe('BadWord');
      expect(result.normalizedKeyword).toBe('badword');
      expect(result.occurrences).toBe(1);
      expect(mockPrisma.tempVoiceKeywordQueue.create).toHaveBeenCalledOnce();
    });

    it('should increment occurrences for existing keyword', async () => {
      const existing = {
        id: 'keyword-1',
        guildId: 'guild-123',
        normalizedKeyword: 'badword',
        contextSnippet: 'Old context',
        channelId: 'channel-1',
        userId: 'user-1',
        occurrences: 2,
      };

      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(existing);
      mockPrisma.tempVoiceKeywordQueue.update.mockResolvedValue({
        ...existing,
        occurrences: 3,
        contextSnippet: 'New context',
      });

      const result = await service.addKeyword({
        guildId: 'guild-123',
        keyword: 'BadWord',
        source: KeywordSource.AUTO_DETECTED,
        contextSnippet: 'New context',
      });

      expect(result.occurrences).toBe(3);
      expect(mockPrisma.tempVoiceKeywordQueue.update).toHaveBeenCalledWith({
        where: { id: 'keyword-1' },
        data: expect.objectContaining({
          occurrences: { increment: 1 },
          contextSnippet: 'New context',
        }),
      });
    });

    it('should normalize keywords for deduplication', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(null);
      mockPrisma.tempVoiceKeywordQueue.create.mockResolvedValue({
        id: 'keyword-1',
        normalizedKeyword: 'badword',
        keyword: 'B@dW0rd',
      });

      await service.addKeyword({
        guildId: 'guild-123',
        keyword: 'B@dW0rd', // Leetspeak
        source: KeywordSource.AUTO_DETECTED,
      });

      // The normalized keyword should be lowercase with special chars handled
      expect(mockPrisma.tempVoiceKeywordQueue.findUnique).toHaveBeenCalledWith({
        where: {
          guildId_normalizedKeyword: {
            guildId: 'guild-123',
            normalizedKeyword: 'b@dw0rd', // Normalized but not fully decoded
          },
        },
      });
    });
  });

  describe('addKeywords (batch)', () => {
    it('should add multiple keywords', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(null);
      mockPrisma.tempVoiceKeywordQueue.create.mockImplementation((data: any) => ({
        id: `keyword-${Math.random()}`,
        ...data.data,
        status: KeywordApprovalStatus.PENDING,
        occurrences: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const keywords = [
        {
          guildId: 'guild-123',
          keyword: 'word1',
          source: KeywordSource.AUTO_DETECTED,
        },
        {
          guildId: 'guild-123',
          keyword: 'word2',
          source: KeywordSource.AUTO_DETECTED,
        },
        {
          guildId: 'guild-123',
          keyword: 'word3',
          source: KeywordSource.AUTO_DETECTED,
        },
      ];

      const results = await service.addKeywords(keywords);

      expect(results).toHaveLength(3);
      expect(mockPrisma.tempVoiceKeywordQueue.create).toHaveBeenCalledTimes(3);
    });

    it('should continue on individual failures', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(null);
      mockPrisma.tempVoiceKeywordQueue.create
        .mockResolvedValueOnce({ id: 'keyword-1' })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 'keyword-3' });

      const keywords = [
        { guildId: 'guild-123', keyword: 'word1', source: KeywordSource.AUTO_DETECTED },
        { guildId: 'guild-123', keyword: 'word2', source: KeywordSource.AUTO_DETECTED },
        { guildId: 'guild-123', keyword: 'word3', source: KeywordSource.AUTO_DETECTED },
      ];

      const results = await service.addKeywords(keywords);

      // Should have 2 successful results (first and third)
      expect(results).toHaveLength(2);
    });
  });

  describe('getPendingKeywords', () => {
    it('should retrieve pending keywords with default filters', async () => {
      const mockKeywords = [
        {
          id: 'keyword-1',
          guildId: 'guild-123',
          keyword: 'test1',
          status: KeywordApprovalStatus.PENDING,
          occurrences: 5,
        },
        {
          id: 'keyword-2',
          guildId: 'guild-123',
          keyword: 'test2',
          status: KeywordApprovalStatus.PENDING,
          occurrences: 3,
        },
      ];

      mockPrisma.tempVoiceKeywordQueue.findMany.mockResolvedValue(mockKeywords);

      const results = await service.getPendingKeywords('guild-123');

      expect(results).toHaveLength(2);
      expect(mockPrisma.tempVoiceKeywordQueue.findMany).toHaveBeenCalledWith({
        where: {
          guildId: 'guild-123',
          status: KeywordApprovalStatus.PENDING,
        },
        orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
        take: 50,
        skip: 0,
      });
    });

    it('should apply custom filters', async () => {
      mockPrisma.tempVoiceKeywordQueue.findMany.mockResolvedValue([]);

      await service.getPendingKeywords('guild-123', {
        source: KeywordSource.MANUAL_REPORT,
        minOccurrences: 3,
        limit: 10,
        offset: 20,
      });

      expect(mockPrisma.tempVoiceKeywordQueue.findMany).toHaveBeenCalledWith({
        where: {
          guildId: 'guild-123',
          status: KeywordApprovalStatus.PENDING,
          source: KeywordSource.MANUAL_REPORT,
          occurrences: { gte: 3 },
        },
        orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
        take: 10,
        skip: 20,
      });
    });
  });

  describe('approveKeyword', () => {
    it('should approve a pending keyword and create pattern', async () => {
      const pendingKeyword = {
        id: 'keyword-1',
        guildId: 'guild-123',
        keyword: 'badword',
        normalizedKeyword: 'badword',
        status: KeywordApprovalStatus.PENDING,
      };

      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(pendingKeyword);
      mockPrisma.tempVoiceKeywordQueue.update.mockResolvedValue({
        ...pendingKeyword,
        status: KeywordApprovalStatus.APPROVED,
        reviewedBy: 'admin-1',
        reviewedAt: new Date(),
      });
      mockPrisma.tempVoiceModerationPattern.create.mockResolvedValue({
        id: 'pattern-1',
        pattern: '\\bbadword\\b',
      });

      const result = await service.approveKeyword('keyword-1', 'admin-1', 'Confirmed bad word');

      expect(result.status).toBe(KeywordApprovalStatus.APPROVED);
      expect(result.patternCreated).toBe(true);
      expect(result.patternId).toBe('pattern-1');
      expect(mockPrisma.tempVoiceModerationPattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pattern: expect.stringContaining('badword'),
          patternType: 'USER_REPORTED',
          severity: 7,
          enabled: true,
        }),
      });
    });

    it('should throw error for non-existent keyword', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(null);

      await expect(
        service.approveKeyword('keyword-999', 'admin-1')
      ).rejects.toThrow('Keyword with ID keyword-999 not found');
    });

    it('should throw error if keyword not pending', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue({
        id: 'keyword-1',
        status: KeywordApprovalStatus.APPROVED,
      });

      await expect(
        service.approveKeyword('keyword-1', 'admin-1')
      ).rejects.toThrow('Keyword is not pending');
    });
  });

  describe('denyKeyword', () => {
    it('should deny a pending keyword without creating pattern', async () => {
      const pendingKeyword = {
        id: 'keyword-1',
        keyword: 'falsepositive',
        status: KeywordApprovalStatus.PENDING,
      };

      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(pendingKeyword);
      mockPrisma.tempVoiceKeywordQueue.update.mockResolvedValue({
        ...pendingKeyword,
        status: KeywordApprovalStatus.DENIED,
        reviewedBy: 'admin-1',
      });

      const result = await service.denyKeyword('keyword-1', 'admin-1', 'False positive');

      expect(result.status).toBe(KeywordApprovalStatus.DENIED);
      expect(result.patternCreated).toBe(false);
      expect(mockPrisma.tempVoiceModerationPattern.create).not.toHaveBeenCalled();
    });
  });

  describe('ignoreKeyword', () => {
    it('should ignore a keyword', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue({
        id: 'keyword-1',
        status: KeywordApprovalStatus.PENDING,
      });
      mockPrisma.tempVoiceKeywordQueue.update.mockResolvedValue({
        id: 'keyword-1',
        status: KeywordApprovalStatus.IGNORED,
      });

      const result = await service.ignoreKeyword('keyword-1', 'admin-1');

      expect(result.status).toBe(KeywordApprovalStatus.IGNORED);
    });
  });

  describe('batch operations', () => {
    it('should approve multiple keywords', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockImplementation((query: any) => ({
        id: query.where.id,
        status: KeywordApprovalStatus.PENDING,
        normalizedKeyword: 'word',
      }));
      mockPrisma.tempVoiceKeywordQueue.update.mockImplementation((query: any) => ({
        id: query.where.id,
        status: KeywordApprovalStatus.APPROVED,
      }));
      mockPrisma.tempVoiceModerationPattern.create.mockResolvedValue({
        id: 'pattern-1',
      });

      const results = await service.approveKeywords(
        ['keyword-1', 'keyword-2', 'keyword-3'],
        'admin-1'
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === KeywordApprovalStatus.APPROVED)).toBe(true);
    });

    it('should deny multiple keywords', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockImplementation((query: any) => ({
        id: query.where.id,
        status: KeywordApprovalStatus.PENDING,
      }));
      mockPrisma.tempVoiceKeywordQueue.update.mockImplementation((query: any) => ({
        id: query.where.id,
        status: KeywordApprovalStatus.DENIED,
      }));

      const results = await service.denyKeywords(['keyword-1', 'keyword-2'], 'admin-1');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === KeywordApprovalStatus.DENIED)).toBe(true);
    });
  });

  describe('getQueueStats', () => {
    it('should return correct statistics', async () => {
      mockPrisma.tempVoiceKeywordQueue.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(10) // approved
        .mockResolvedValueOnce(3) // denied
        .mockResolvedValueOnce(2) // ignored
        .mockResolvedValueOnce(20); // total

      const stats = await service.getQueueStats('guild-123');

      expect(stats).toEqual({
        pending: 5,
        approved: 10,
        denied: 3,
        ignored: 2,
        total: 20,
      });
    });
  });

  describe('cleanupOldKeywords', () => {
    it('should delete old reviewed keywords', async () => {
      mockPrisma.tempVoiceKeywordQueue.deleteMany.mockResolvedValue({ count: 15 });

      const deletedCount = await service.cleanupOldKeywords('guild-123', 90);

      expect(deletedCount).toBe(15);
      expect(mockPrisma.tempVoiceKeywordQueue.deleteMany).toHaveBeenCalledWith({
        where: {
          guildId: 'guild-123',
          status: { not: KeywordApprovalStatus.PENDING },
          reviewedAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('pattern creation', () => {
    it('should escape special regex characters in patterns', async () => {
      const keyword = {
        id: 'keyword-1',
        keyword: 'test.word',
        normalizedKeyword: 'test.word',
        status: KeywordApprovalStatus.PENDING,
      };

      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue(keyword);
      mockPrisma.tempVoiceKeywordQueue.update.mockResolvedValue({
        ...keyword,
        status: KeywordApprovalStatus.APPROVED,
      });
      mockPrisma.tempVoiceModerationPattern.create.mockResolvedValue({
        id: 'pattern-1',
      });

      await service.approveKeyword('keyword-1', 'admin-1');

      expect(mockPrisma.tempVoiceModerationPattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pattern: '\\btest\\.word\\b', // Dot should be escaped
        }),
      });
    });

    it('should handle pattern creation failure gracefully', async () => {
      mockPrisma.tempVoiceKeywordQueue.findUnique.mockResolvedValue({
        id: 'keyword-1',
        status: KeywordApprovalStatus.PENDING,
        normalizedKeyword: 'word',
      });
      mockPrisma.tempVoiceKeywordQueue.update.mockResolvedValue({
        id: 'keyword-1',
        status: KeywordApprovalStatus.APPROVED,
      });
      mockPrisma.tempVoiceModerationPattern.create.mockRejectedValue(
        new Error('Pattern creation failed')
      );

      const result = await service.approveKeyword('keyword-1', 'admin-1');

      // Should still mark as approved even if pattern creation fails
      expect(result.status).toBe(KeywordApprovalStatus.APPROVED);
      expect(result.patternCreated).toBe(false);
    });
  });
});
