import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ALL mocks must be hoisted since vi.mock factories are hoisted
const {
  mockGetJson,
  mockSetJson,
  mockWatermarkClient,
  mockStorageService,
  mockEvidenceFindUnique,
} = vi.hoisted(() => ({
  mockGetJson: vi.fn(),
  mockSetJson: vi.fn(),
  mockWatermarkClient: {
    applyWatermarkWithFallback: vi.fn(),
  },
  mockStorageService: {
    isConfigured: true,
    generateDownloadUrl: vi.fn(),
    generateViewUrl: vi.fn(),
    verifyUpload: vi.fn(),
    downloadToBuffer: vi.fn(),
    uploadBuffer: vi.fn(),
  },
  mockEvidenceFindUnique: vi.fn(),
}));

vi.mock('@sapphire/framework', async () => {
  const actual = await vi.importActual('@sapphire/framework');
  return {
    ...actual,
    container: {
      prisma: {
        evidence: {
          findUnique: mockEvidenceFindUnique,
        },
      },
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
    },
  };
});

vi.mock('#lib/storage/StorageService.js', () => ({
  storageService: mockStorageService,
}));

vi.mock('#lib/cache/typedCache.js', () => ({
  getJson: mockGetJson,
  setJson: mockSetJson,
}));

vi.mock('#lib/services/watermark-client.js', () => ({
  watermarkClient: mockWatermarkClient,
}));

import { watermarkService } from '#modules/moderation/services/WatermarkService.js';
import { Buffer } from 'node:buffer';

describe('WatermarkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService.isConfigured = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getWatermarkedUrl', () => {
    const imageEvidence = {
      id: 'ev-1',
      type: 'IMAGE',
      storageKey: 'guilds/g1/cases/1/evidence/ev-1/photo.png',
      url: null,
      mimeType: 'image/png',
      originalFilename: 'photo.png',
    };

    it('returns watermarked URL for IMAGE evidence', async () => {
      mockEvidenceFindUnique.mockResolvedValue(imageEvidence);
      mockGetJson.mockResolvedValue(null); // No cache
      mockStorageService.downloadToBuffer.mockResolvedValue(Buffer.from('fake-image'));
      mockWatermarkClient.applyWatermarkWithFallback.mockResolvedValue({
        buffer: Buffer.from('watermarked-image'),
        usedRustService: true,
      });
      mockStorageService.uploadBuffer.mockResolvedValue(undefined);
      mockSetJson.mockResolvedValue(undefined);
      mockStorageService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/watermarked');

      const result = await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234 @ 2025-01-15');

      expect(result.url).toBe('https://cdn.example.com/watermarked');
      expect(result.watermarked).toBe(true);
    });

    it('uses cached watermarked version when available and file exists', async () => {
      mockEvidenceFindUnique.mockResolvedValue(imageEvidence);
      mockGetJson.mockResolvedValue({
        watermarkedKey: 'watermarked/abc123/guilds/g1/cases/1/evidence/ev-1/photo.png',
        cachedAt: Date.now(),
      });
      mockStorageService.verifyUpload.mockResolvedValue(true);
      mockStorageService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/cached');

      const result = await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234');

      expect(result.url).toBe('https://cdn.example.com/cached');
      expect(result.watermarked).toBe(true);
      // Should NOT have downloaded or applied watermark
      expect(mockStorageService.downloadToBuffer).not.toHaveBeenCalled();
      expect(mockWatermarkClient.applyWatermarkWithFallback).not.toHaveBeenCalled();
    });

    it('regenerates when cached file no longer exists in storage', async () => {
      mockEvidenceFindUnique.mockResolvedValue(imageEvidence);
      mockGetJson.mockResolvedValue({
        watermarkedKey: 'watermarked/abc123/key',
        cachedAt: Date.now(),
      });
      mockStorageService.verifyUpload.mockResolvedValue(false); // File deleted from B2
      mockStorageService.downloadToBuffer.mockResolvedValue(Buffer.from('original'));
      mockWatermarkClient.applyWatermarkWithFallback.mockResolvedValue({
        buffer: Buffer.from('watermarked'),
        usedRustService: false,
      });
      mockStorageService.uploadBuffer.mockResolvedValue(undefined);
      mockSetJson.mockResolvedValue(undefined);
      mockStorageService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/regen');

      const result = await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234');

      expect(result.watermarked).toBe(true);
      expect(mockStorageService.downloadToBuffer).toHaveBeenCalled();
    });

    it('passes through URL evidence without watermarking', async () => {
      const urlEvidence = {
        id: 'ev-2',
        type: 'URL',
        storageKey: null,
        url: 'https://example.com/evidence',
        mimeType: null,
        originalFilename: null,
      };
      mockEvidenceFindUnique.mockResolvedValue(urlEvidence);

      const result = await watermarkService.getWatermarkedUrl('ev-2', 'guild-1', 'User#1234');

      expect(result.url).toBe('https://example.com/evidence');
      expect(result.watermarked).toBe(false);
    });

    it('passes through non-image file evidence without watermarking', async () => {
      const videoEvidence = {
        id: 'ev-3',
        type: 'VIDEO',
        storageKey: 'guilds/g1/cases/1/evidence/ev-3/video.mp4',
        url: null,
        mimeType: 'video/mp4',
        originalFilename: 'video.mp4',
      };
      mockEvidenceFindUnique.mockResolvedValue(videoEvidence);
      mockStorageService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/video');

      const result = await watermarkService.getWatermarkedUrl('ev-3', 'guild-1', 'User#1234');

      expect(result.url).toBe('https://cdn.example.com/video');
      expect(result.watermarked).toBe(false);
    });

    it('throws when evidence not found', async () => {
      mockEvidenceFindUnique.mockResolvedValue(null);

      await expect(
        watermarkService.getWatermarkedUrl('nonexistent', 'guild-1', 'User#1234')
      ).rejects.toThrow('Evidence not found');
    });

    it('throws when storage is not configured', async () => {
      mockEvidenceFindUnique.mockResolvedValue(imageEvidence);
      mockStorageService.isConfigured = false;

      await expect(
        watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234')
      ).rejects.toThrow('Storage not configured');
    });

    it('different watermark texts produce different cache keys', async () => {
      mockEvidenceFindUnique.mockResolvedValue(imageEvidence);
      mockGetJson.mockResolvedValue(null);
      mockStorageService.downloadToBuffer.mockResolvedValue(Buffer.from('img'));
      mockWatermarkClient.applyWatermarkWithFallback.mockResolvedValue({
        buffer: Buffer.from('wm'),
        usedRustService: true,
      });
      mockStorageService.uploadBuffer.mockResolvedValue(undefined);
      mockSetJson.mockResolvedValue(undefined);
      mockStorageService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/wm');

      await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234 @ 10:00');
      await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#5678 @ 11:00');

      // Two different cache keys should have been checked
      const cacheKey1 = mockGetJson.mock.calls[0]![0] as string;
      const cacheKey2 = mockGetJson.mock.calls[1]![0] as string;
      expect(cacheKey1).not.toBe(cacheKey2);
    });

    it('caches watermarked mapping in Redis with 1hr TTL', async () => {
      mockEvidenceFindUnique.mockResolvedValue(imageEvidence);
      mockGetJson.mockResolvedValue(null);
      mockStorageService.downloadToBuffer.mockResolvedValue(Buffer.from('img'));
      mockWatermarkClient.applyWatermarkWithFallback.mockResolvedValue({
        buffer: Buffer.from('wm'),
        usedRustService: true,
      });
      mockStorageService.uploadBuffer.mockResolvedValue(undefined);
      mockSetJson.mockResolvedValue(undefined);
      mockStorageService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/wm');

      await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234');

      expect(mockSetJson).toHaveBeenCalledWith(
        expect.stringContaining('watermark:ev-1:'),
        expect.anything(), // schema
        expect.objectContaining({ watermarkedKey: expect.any(String) }),
        3600 // 1 hour TTL
      );
    });

    it('determines correct output format from MIME type', async () => {
      // Test JPEG format
      const jpegEvidence = { ...imageEvidence, mimeType: 'image/jpeg' };
      mockEvidenceFindUnique.mockResolvedValue(jpegEvidence);
      mockGetJson.mockResolvedValue(null);
      mockStorageService.downloadToBuffer.mockResolvedValue(Buffer.from('img'));
      mockWatermarkClient.applyWatermarkWithFallback.mockResolvedValue({
        buffer: Buffer.from('wm'),
        usedRustService: true,
      });
      mockStorageService.uploadBuffer.mockResolvedValue(undefined);
      mockSetJson.mockResolvedValue(undefined);
      mockStorageService.generateDownloadUrl.mockResolvedValue('url');

      await watermarkService.getWatermarkedUrl('ev-1', 'guild-1', 'User#1234');

      expect(mockWatermarkClient.applyWatermarkWithFallback).toHaveBeenCalledWith(
        expect.any(Buffer),
        'User#1234',
        'jpeg'
      );
    });

    it('throws when non-image evidence has no URL or storage key', async () => {
      const brokenEvidence = {
        id: 'ev-broken',
        type: 'DOCUMENT',
        storageKey: null,
        url: null,
        mimeType: null,
        originalFilename: null,
      };
      mockEvidenceFindUnique.mockResolvedValue(brokenEvidence);

      await expect(
        watermarkService.getWatermarkedUrl('ev-broken', 'guild-1', 'User#1234')
      ).rejects.toThrow('No downloadable content');
    });
  });
});
