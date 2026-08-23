import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { container } from '@sapphire/framework';

// Hoisted mock for publish function
const { mockPublish } = vi.hoisted(() => {
  return {
    mockPublish: vi.fn(() => Promise.resolve()),
  };
});

// Mock dependencies
vi.mock('@sapphire/framework', async () => {
  const actual = await vi.importActual('@sapphire/framework');
  return {
    ...actual,
    container: {
      prisma: {
        modCase: {
          findFirst: vi.fn(),
        },
        evidence: {
          create: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          update: vi.fn(),
        },
        evidenceAmendment: {
          create: vi.fn(),
          findMany: vi.fn(),
        },
        messageSnapshot: {
          create: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
        },
      },
      logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      client: {
        guilds: {
          cache: new Map(),
        },
      },
    },
  };
});

vi.mock('#lib/storage/StorageService.js', () => ({
  storageService: {
    isConfigured: false,
    generateUploadUrl: vi.fn(),
    verifyUpload: vi.fn(),
    generateViewUrl: vi.fn(),
    generateDownloadUrl: vi.fn(),
    uploadBuffer: vi.fn(),
  },
  StorageService: {
    buildKey: vi.fn((guildId, caseNum, evidenceId, filename) =>
      `guilds/${guildId}/cases/${caseNum}/evidence/${evidenceId}/${filename}`
    ),
    buildSnapshotMediaKey: vi.fn((guildId, snapshotId, filename) =>
      `guilds/${guildId}/snapshots/${snapshotId}/media/${filename}`
    ),
  },
}));

vi.mock('#lib/storage/SigningService.js', () => ({
  signingService: {
    isConfigured: false,
    sign: vi.fn(),
    verify: vi.fn(),
  },
  SigningService: {
    sha256: vi.fn(() => 'mock-sha256-hash'),
    buildMetadata: vi.fn((evidence) => ({
      evidenceId: evidence.id,
      guildId: evidence.guildId,
      caseId: evidence.caseId,
      uploadedById: evidence.uploadedById,
      timestamp: evidence.createdAt.toISOString(),
    })),
  },
}));

vi.mock('#lib/validation/WeightGate.js', () => ({
  WeightGate: {
    recordUpload: vi.fn(),
  },
}));

vi.mock('#lib/redis.js', () => ({
  publish: mockPublish,
  ModEventChannels: {
    MOD_EVENTS: (guildId: string) => `mod:events:${guildId}`,
  },
}));

vi.mock('#lib/utils/ogFetcher.js', () => ({
  fetchOGData: vi.fn(),
}));

vi.mock('#config.js', () => ({
  CONFIG: {
    B2_BUCKET_NAME: 'test-bucket',
    MAX_SNAPSHOT_MESSAGES: 100,
    DASHBOARD_URL: 'https://dashboard.example.com',
  },
}));

import { EvidenceService } from '#modules/moderation/services/EvidenceService.js';
import { storageService, StorageService } from '#lib/storage/StorageService.js';
import { signingService } from '#lib/storage/SigningService.js';
import { WeightGate } from '#lib/validation/WeightGate.js';

// Use hoisted mock for assertions
const publish = mockPublish;

describe('EvidenceService', () => {
  let service: EvidenceService;

  beforeEach(() => {
    service = new EvidenceService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initiateUpload', () => {
    const mockCase = {
      id: 'case-123',
      guildId: 'guild-1',
      caseNumber: 42,
    };

    it('should create PENDING evidence record', async () => {
      vi.mocked(container.prisma.modCase.findFirst).mockResolvedValue(mockCase as any);
      vi.mocked(container.prisma.evidence.create).mockResolvedValue({
        id: 'evidence-1',
        guildId: 'guild-1',
        caseNumber: 42,
        status: 'PENDING',
      } as any);
      vi.mocked(container.prisma.evidence.update).mockResolvedValue({} as any);

      const result = await service.initiateUpload({
        guildId: 'guild-1',
        caseNumber: 42,
        uploadedById: 'user-1',
        uploadedByTag: 'User#1234',
        filename: 'screenshot.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      });

      expect(container.prisma.evidence.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: 'guild-1',
          caseId: 'case-123',
          caseNumber: 42,
          status: 'PENDING',
          mimeType: 'image/png',
        }),
      });
      expect(result.evidenceId).toBe('evidence-1');
    });

    it('should throw when case does not exist', async () => {
      vi.mocked(container.prisma.modCase.findFirst).mockResolvedValue(null);

      await expect(
        service.initiateUpload({
          guildId: 'guild-1',
          caseNumber: 999,
          uploadedById: 'user-1',
          uploadedByTag: 'User#1234',
          filename: 'file.txt',
          mimeType: 'text/plain',
          sizeBytes: 100,
        })
      ).rejects.toThrow('Case #999 not found');
    });

    it('should generate correct storage key format', async () => {
      vi.mocked(container.prisma.modCase.findFirst).mockResolvedValue(mockCase as any);
      vi.mocked(container.prisma.evidence.create).mockResolvedValue({
        id: 'evidence-abc',
        guildId: 'guild-1',
      } as any);
      vi.mocked(container.prisma.evidence.update).mockResolvedValue({} as any);

      await service.initiateUpload({
        guildId: 'guild-1',
        caseNumber: 42,
        uploadedById: 'user-1',
        uploadedByTag: 'User#1234',
        filename: 'test.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      });

      expect(StorageService.buildKey).toHaveBeenCalledWith(
        'guild-1',
        42,
        'evidence-abc',
        'test.png'
      );
    });

    it('should return presigned URL when storage is configured', async () => {
      vi.mocked(container.prisma.modCase.findFirst).mockResolvedValue(mockCase as any);
      vi.mocked(container.prisma.evidence.create).mockResolvedValue({
        id: 'evidence-1',
      } as any);
      vi.mocked(container.prisma.evidence.update).mockResolvedValue({} as any);

      // Enable storage
      Object.defineProperty(storageService, 'isConfigured', { value: true });
      vi.mocked(storageService.generateUploadUrl).mockResolvedValue({
        uploadUrl: 'https://upload.example.com/presigned',
        key: 'test-key',
        expiresAt: new Date(),
      });

      const result = await service.initiateUpload({
        guildId: 'guild-1',
        caseNumber: 42,
        uploadedById: 'user-1',
        uploadedByTag: 'User#1234',
        filename: 'file.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      });

      expect(result.uploadUrl).toBe('https://upload.example.com/presigned');

      // Reset
      Object.defineProperty(storageService, 'isConfigured', { value: false });
    });
  });

  describe('confirmUpload', () => {
    const mockEvidence = {
      id: 'evidence-1',
      guildId: 'guild-1',
      caseId: 'case-1',
      caseNumber: 42,
      status: 'PENDING',
      storageKey: 'test-key',
      sizeBytes: 1024,
      uploadedById: 'user-1',
      createdAt: new Date(),
    };

    it('should update status to VERIFIED', async () => {
      // Use evidence without storage key to skip storage verification
      const evidenceNoKey = { ...mockEvidence, storageKey: null };
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(evidenceNoKey as any);

      const confirmedEvidence = {
        ...evidenceNoKey,
        status: 'VERIFIED',
        contentHash: 'hash123',
        hmacSignature: null,
      };
      vi.mocked(container.prisma.evidence.update).mockResolvedValue(confirmedEvidence as any);

      const result = await service.confirmUpload('evidence-1', 'hash123');

      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: expect.objectContaining({
          status: 'VERIFIED',
          contentHash: 'hash123',
        }),
      });
      expect(result.status).toBe('VERIFIED');
    });

    it('should sign content when signing service is configured', async () => {
      const evidenceNoKey = { ...mockEvidence, storageKey: null };
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(evidenceNoKey as any);

      const confirmedEvidence = {
        ...evidenceNoKey,
        status: 'VERIFIED',
        contentHash: 'hash123',
        hmacSignature: 'hmac-signature',
      };
      vi.mocked(container.prisma.evidence.update).mockResolvedValue(confirmedEvidence as any);

      // Enable signing
      Object.defineProperty(signingService, 'isConfigured', { value: true });
      vi.mocked(signingService.sign).mockReturnValue('hmac-signature');

      await service.confirmUpload('evidence-1', 'hash123');

      expect(signingService.sign).toHaveBeenCalled();
      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: expect.objectContaining({
          hmacSignature: 'hmac-signature',
        }),
      });

      Object.defineProperty(signingService, 'isConfigured', { value: false });
    });

    it('should reject when evidence not in PENDING/PROCESSING state', async () => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue({
        ...mockEvidence,
        status: 'VERIFIED',
      } as any);

      await expect(service.confirmUpload('evidence-1', 'hash123')).rejects.toThrow(
        'Evidence is in VERIFIED state, cannot confirm'
      );
    });

    it('should throw when evidence not found', async () => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(null);

      await expect(service.confirmUpload('nonexistent', 'hash')).rejects.toThrow(
        'Evidence not found'
      );
    });

    it('should verify file exists in storage when storage key present', async () => {
      Object.defineProperty(storageService, 'isConfigured', { value: true });
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(mockEvidence as any);
      vi.mocked(storageService.verifyUpload).mockResolvedValue(true);

      const confirmedEvidence = {
        ...mockEvidence,
        status: 'VERIFIED',
        contentHash: 'hash123',
        hmacSignature: null,
      };
      vi.mocked(container.prisma.evidence.update).mockResolvedValue(confirmedEvidence as any);

      await service.confirmUpload('evidence-1', 'hash123');

      expect(storageService.verifyUpload).toHaveBeenCalledWith('test-key');

      Object.defineProperty(storageService, 'isConfigured', { value: false });
    });

    it('should throw when file not found in storage', async () => {
      Object.defineProperty(storageService, 'isConfigured', { value: true });
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(mockEvidence as any);
      vi.mocked(storageService.verifyUpload).mockResolvedValue(false);

      await expect(service.confirmUpload('evidence-1', 'hash123')).rejects.toThrow(
        'File not found in storage'
      );

      Object.defineProperty(storageService, 'isConfigured', { value: false });
    });

    it('should record upload weight for rate limiting', async () => {
      const evidenceNoKey = { ...mockEvidence, storageKey: null };
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(evidenceNoKey as any);

      const confirmedEvidence = {
        ...evidenceNoKey,
        status: 'VERIFIED',
        contentHash: 'hash123',
        hmacSignature: null,
      };
      vi.mocked(container.prisma.evidence.update).mockResolvedValue(confirmedEvidence as any);

      await service.confirmUpload('evidence-1', 'hash123');

      expect(WeightGate.recordUpload).toHaveBeenCalledWith('user-1', 'guild-1', 1024);
    });

    it('should publish real-time event', async () => {
      const evidenceNoKey = { ...mockEvidence, storageKey: null };
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(evidenceNoKey as any);

      const confirmedEvidence = {
        ...evidenceNoKey,
        status: 'VERIFIED',
        contentHash: 'hash123',
        hmacSignature: null,
      };
      vi.mocked(container.prisma.evidence.update).mockResolvedValue(confirmedEvidence as any);

      await service.confirmUpload('evidence-1', 'hash123');

      expect(publish).toHaveBeenCalledWith(
        'mod:events:guild-1',
        expect.objectContaining({
          type: 'evidence:created',
          evidenceId: 'evidence-1',
        })
      );
    });
  });

  describe('amendEvidence', () => {
    const mockEvidence = {
      id: 'evidence-1',
      guildId: 'guild-1',
      caseNumber: 42,
      description: 'Original description',
      status: 'VERIFIED',
      tags: ['original'],
    };

    const mockAmendment = {
      id: 'amendment-1',
      evidenceId: 'evidence-1',
      amendedById: 'mod-1',
      amendedByTag: 'Mod#1234',
      createdAt: new Date(),
    };

    beforeEach(() => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(mockEvidence as any);
      vi.mocked(container.prisma.evidenceAmendment.create).mockResolvedValue(mockAmendment as any);
      vi.mocked(container.prisma.evidence.update).mockResolvedValue(mockEvidence as any);
    });

    it('should create amendment record with previous value', async () => {
      const result = await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'DESCRIPTION_UPDATED',
        newValue: 'New description',
      });

      expect(container.prisma.evidenceAmendment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          evidenceId: 'evidence-1',
          action: 'DESCRIPTION_UPDATED',
          previousValue: JSON.stringify({ description: 'Original description' }),
          newValue: 'New description',
        }),
      });
      expect(result.id).toBe('amendment-1');
    });

    it('should update description on DESCRIPTION_UPDATED', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'DESCRIPTION_UPDATED',
        newValue: 'Updated description',
      });

      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: { description: 'Updated description' },
      });
    });

    it('should update status to FLAGGED on FLAGGED action', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'FLAGGED',
        reason: 'Suspicious content',
      });

      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: { status: 'FLAGGED' },
      });
    });

    it('should update status to VERIFIED on UNFLAGGED action', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'UNFLAGGED',
      });

      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: { status: 'VERIFIED' },
      });
    });

    it('should validate and sanitize tags on TAGS_UPDATED', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'TAGS_UPDATED',
        newValue: JSON.stringify(['Valid-Tag', 'another_tag', 'UPPERCASE']),
      });

      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: { tags: ['valid-tag', 'another_tag', 'uppercase'] },
      });
    });

    it('should filter out invalid tags', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'TAGS_UPDATED',
        newValue: JSON.stringify([
          'valid',
          'invalid tag with spaces',
          'valid-2',
          'has@special!chars',
        ]),
      });

      expect(container.prisma.evidence.update).toHaveBeenCalledWith({
        where: { id: 'evidence-1' },
        data: { tags: ['valid', 'valid-2'] },
      });
    });

    it('should reject invalid JSON for tags silently', async () => {
      const result = await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'TAGS_UPDATED',
        newValue: 'not valid json',
      });

      // Amendment is created but tags update fails silently
      expect(container.prisma.evidenceAmendment.create).toHaveBeenCalled();
      expect(result.id).toBe('amendment-1');
    });

    it('should publish real-time event', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'DESCRIPTION_UPDATED',
        newValue: 'New desc',
      });

      expect(publish).toHaveBeenCalledWith(
        'mod:events:guild-1',
        expect.objectContaining({
          type: 'evidence:amended',
        })
      );
    });

    it('should publish status-changed event for flag actions', async () => {
      await service.amendEvidence({
        evidenceId: 'evidence-1',
        amendedById: 'mod-1',
        amendedByTag: 'Mod#1234',
        action: 'FLAGGED',
      });

      expect(publish).toHaveBeenCalledWith(
        'mod:events:guild-1',
        expect.objectContaining({
          type: 'evidence:status-changed',
        })
      );
    });

    it('should throw when evidence not found', async () => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(null);

      await expect(
        service.amendEvidence({
          evidenceId: 'nonexistent',
          amendedById: 'mod-1',
          amendedByTag: 'Mod#1234',
          action: 'FLAGGED',
        })
      ).rejects.toThrow('Evidence not found');
    });
  });

  describe('getEvidenceForGuild', () => {
    it('should return paginated evidence', async () => {
      const mockEvidence = [
        { id: 'ev-1', type: 'IMAGE' },
        { id: 'ev-2', type: 'VIDEO' },
      ];
      vi.mocked(container.prisma.evidence.findMany).mockResolvedValue(mockEvidence as any);
      vi.mocked(container.prisma.evidence.count).mockResolvedValue(50);

      const result = await service.getEvidenceForGuild('guild-1', { page: 1, limit: 10 });

      expect(result.evidence).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(5);
    });

    it('should filter by type, status, and tags', async () => {
      vi.mocked(container.prisma.evidence.findMany).mockResolvedValue([]);
      vi.mocked(container.prisma.evidence.count).mockResolvedValue(0);

      await service.getEvidenceForGuild('guild-1', {
        type: 'IMAGE',
        status: 'VERIFIED',
        tags: ['important', 'review'],
      });

      expect(container.prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            guildId: 'guild-1',
            type: 'IMAGE',
            status: 'VERIFIED',
            tags: { hasSome: ['important', 'review'] },
          },
        })
      );
    });

    it('should clamp limit to maximum of 100', async () => {
      vi.mocked(container.prisma.evidence.findMany).mockResolvedValue([]);
      vi.mocked(container.prisma.evidence.count).mockResolvedValue(0);

      await service.getEvidenceForGuild('guild-1', { limit: 500 });

      expect(container.prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('getEvidenceSummary', () => {
    it('should return aggregated evidence summary', async () => {
      const mockItems = [
        { type: 'IMAGE', status: 'VERIFIED', sizeBytes: 1000, createdAt: new Date('2024-01-01') },
        { type: 'IMAGE', status: 'VERIFIED', sizeBytes: 2000, createdAt: new Date('2024-01-02') },
        { type: 'VIDEO', status: 'FLAGGED', sizeBytes: 5000, createdAt: new Date('2024-01-03') },
      ];
      vi.mocked(container.prisma.evidence.findMany).mockResolvedValue(mockItems as any);

      const result = await service.getEvidenceSummary('guild-1', 42);

      expect(result.total).toBe(3);
      expect(result.byType).toEqual({ IMAGE: 2, VIDEO: 1 });
      expect(result.byStatus).toEqual({ VERIFIED: 2, FLAGGED: 1 });
      expect(result.totalSizeBytes).toBe(8000);
      expect(result.hasWeakEvidenceOnly).toBe(false);
    });

    it('should detect weak evidence only (DISCORD_URL only)', async () => {
      const mockItems = [
        { type: 'DISCORD_URL', status: 'VERIFIED', sizeBytes: 0, createdAt: new Date() },
        { type: 'DISCORD_URL', status: 'VERIFIED', sizeBytes: 0, createdAt: new Date() },
      ];
      vi.mocked(container.prisma.evidence.findMany).mockResolvedValue(mockItems as any);

      const result = await service.getEvidenceSummary('guild-1', 42);

      expect(result.hasWeakEvidenceOnly).toBe(true);
    });

    it('should not flag as weak when non-Discord evidence exists', async () => {
      const mockItems = [
        { type: 'DISCORD_URL', status: 'VERIFIED', sizeBytes: 0, createdAt: new Date() },
        { type: 'IMAGE', status: 'VERIFIED', sizeBytes: 1000, createdAt: new Date() },
      ];
      vi.mocked(container.prisma.evidence.findMany).mockResolvedValue(mockItems as any);

      const result = await service.getEvidenceSummary('guild-1', 42);

      expect(result.hasWeakEvidenceOnly).toBe(false);
    });
  });

  describe('generateViewUrl', () => {
    it('should return direct URL for URL-type evidence', async () => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue({
        id: 'ev-1',
        url: 'https://example.com/image.png',
        storageKey: null,
      } as any);

      const result = await service.generateViewUrl('ev-1');

      expect(result).toBe('https://example.com/image.png');
    });

    it('should generate presigned URL for storage-backed evidence', async () => {
      Object.defineProperty(storageService, 'isConfigured', { value: true });
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue({
        id: 'ev-1',
        url: null,
        storageKey: 'guilds/g1/cases/1/evidence/ev-1/file.png',
      } as any);
      vi.mocked(storageService.generateViewUrl).mockResolvedValue(
        'https://presigned.example.com/view'
      );

      const result = await service.generateViewUrl('ev-1');

      expect(result).toBe('https://presigned.example.com/view');
      expect(storageService.generateViewUrl).toHaveBeenCalledWith(
        'guilds/g1/cases/1/evidence/ev-1/file.png'
      );

      Object.defineProperty(storageService, 'isConfigured', { value: false });
    });

    it('should throw when evidence has no viewable content', async () => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue({
        id: 'ev-1',
        url: null,
        storageKey: null,
      } as any);

      await expect(service.generateViewUrl('ev-1')).rejects.toThrow(
        'No viewable content for this evidence item'
      );
    });

    it('should throw when evidence not found', async () => {
      vi.mocked(container.prisma.evidence.findUnique).mockResolvedValue(null);

      await expect(service.generateViewUrl('nonexistent')).rejects.toThrow('Evidence not found');
    });
  });

  describe('URL generation helpers', () => {
    it('should generate correct case URL', () => {
      const url = service.generateCaseUrl('guild-123', 42);

      expect(url).toBe('https://dashboard.example.com/mod/guild-123/cases/42');
    });

    it('should generate correct evidence list URL', () => {
      const url = service.generateEvidenceListUrl('guild-123', 42);

      expect(url).toBe('https://dashboard.example.com/mod/guild-123/cases/42/evidence');
    });
  });

  describe('getNextCaseNumber', () => {
    it('should return next case number based on last case', async () => {
      vi.mocked(container.prisma.modCase.findFirst).mockResolvedValue({
        caseNumber: 41,
      } as any);

      const result = await service.getNextCaseNumber('guild-1');

      expect(result).toBe(42);
    });

    it('should return 1 when no cases exist', async () => {
      vi.mocked(container.prisma.modCase.findFirst).mockResolvedValue(null);

      const result = await service.getNextCaseNumber('guild-1');

      expect(result).toBe(1);
    });
  });
});
