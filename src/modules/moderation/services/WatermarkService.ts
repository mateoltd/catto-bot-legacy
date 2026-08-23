/**
 * WatermarkService - Apply watermarks to evidence images for downloads
 *
 * B2 cost-optimized:
 * - Caches watermarked images at `watermarked/{originalKey}` in B2
 * - Uses Redis to track cache validity (1hr TTL) before checking B2
 * - Only fetches from B2 once, watermarks, uploads, then returns presigned URL
 * - Skips watermarking for non-images (pass through directly)
 *
 * Uses Rust microservice for watermarking when available, falls back to Sharp.
 */

import { Buffer } from 'node:buffer';
import { container } from '@sapphire/framework';
import { storageService } from '#lib/storage/StorageService.js';
import { getJson, setJson } from '#lib/cache/typedCache.js';
import { watermarkClient, type OutputFormat } from '#lib/services/watermark-client.js';
import { z } from 'zod';

const WATERMARK_CACHE_TTL = 3600; // 1 hour

const watermarkCacheSchema = z.object({
  watermarkedKey: z.string(),
  cachedAt: z.number(),
});

class WatermarkServiceClass {
  /**
   * Get a presigned URL for a watermarked version of the evidence.
   * If watermarking is not applicable (non-image), returns the original URL.
   */
  async getWatermarkedUrl(
    evidenceId: string,
    _guildId: string,
    watermarkText: string
  ): Promise<{ url: string; watermarked: boolean }> {
    const evidence = await container.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new Error('Evidence not found');
    }

    // Only watermark images
    if (evidence.type !== 'IMAGE' || !evidence.storageKey) {
      // Pass through for non-images or URL evidence
      if (evidence.url) {
        return { url: evidence.url, watermarked: false };
      }
      if (evidence.storageKey && storageService.isConfigured) {
        const url = await storageService.generateDownloadUrl(
          evidence.storageKey,
          evidence.originalFilename ?? `evidence_${evidenceId}`
        );
        return { url, watermarked: false };
      }
      throw new Error('No downloadable content');
    }

    if (!storageService.isConfigured) {
      throw new Error('Storage not configured');
    }

    // Check Redis cache first
    const textHash = this.hashText(watermarkText);
    const cacheKey = `watermark:${evidenceId}:${textHash}`;
    const cached = await getJson(cacheKey, watermarkCacheSchema);

    if (cached) {
      // Verify the watermarked file still exists
      const exists = await storageService.verifyUpload(cached.watermarkedKey);
      if (exists) {
        const url = await storageService.generateDownloadUrl(
          cached.watermarkedKey,
          `watermarked_${evidence.originalFilename ?? evidenceId}`
        );
        return { url, watermarked: true };
      }
    }

    // Generate watermarked version - include text hash so different watermarks don't overwrite
    const watermarkedKey = `watermarked/${textHash}/${evidence.storageKey}`;

    // Download original
    const originalBuffer = await storageService.downloadToBuffer(evidence.storageKey);

    // Apply watermark
    const watermarkedBuffer = await this.applyWatermark(
      originalBuffer,
      watermarkText,
      evidence.mimeType ?? 'image/png'
    );

    // Upload watermarked version
    await storageService.uploadBuffer(
      watermarkedKey,
      watermarkedBuffer,
      evidence.mimeType ?? 'image/png'
    );

    // Cache the mapping
    await setJson(
      cacheKey,
      watermarkCacheSchema,
      {
        watermarkedKey,
        cachedAt: Date.now(),
      },
      WATERMARK_CACHE_TTL
    );

    // Return presigned URL
    const url = await storageService.generateDownloadUrl(
      watermarkedKey,
      `watermarked_${evidence.originalFilename ?? evidenceId}`
    );

    return { url, watermarked: true };
  }

  /**
   * Apply a text watermark to an image buffer.
   * Uses Rust microservice when available, falls back to Sharp.
   */
  private async applyWatermark(buffer: Buffer, text: string, mimeType: string): Promise<Buffer> {
    // Determine output format from mime type
    let format: OutputFormat = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      format = 'jpeg';
    } else if (mimeType.includes('webp')) {
      format = 'webp';
    }

    const result = await watermarkClient.applyWatermarkWithFallback(buffer, text, format);

    if (result.usedRustService) {
      container.logger.debug('Watermark applied using Rust microservice');
    } else {
      container.logger.debug('Watermark applied using Sharp fallback');
    }

    return result.buffer;
  }

  /**
   * Simple hash for cache key differentiation.
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export const watermarkService = new WatermarkServiceClass();
