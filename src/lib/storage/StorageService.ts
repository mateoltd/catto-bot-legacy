/**
 * Storage Service - Backblaze B2 via S3-compatible API
 *
 * Provides presigned upload/download URLs, server-side uploads,
 * and file integrity verification for the evidence system.
 *
 * B2 S3-Compatible API Notes:
 * - Endpoint format: s3.<region>.backblazeb2.com
 * - Only v4 signatures are supported (v2 not supported)
 * - Cannot use master application key; requires a dedicated app key
 * - Max single-part upload: 5 GB (use multipart for larger)
 * - Presigned URLs expire between 1 second and 1 week (604800s)
 * - CORS rules must be configured on the bucket for browser uploads
 * - forcePathStyle is required for reliable operation with B2
 *
 * @see https://www.backblaze.com/docs/cloud-storage-s3-compatible-api
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { container } from '@sapphire/framework';
import { Buffer } from 'node:buffer';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { CONFIG } from '#config.js';

/** Max single-part upload size for B2 (5 GB). */
export const B2_MAX_SINGLE_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/** Max presigned URL expiry for B2 (1 week). */
export const B2_MAX_PRESIGN_EXPIRY_SECONDS = 604800;

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export interface UploadResult {
  key: string;
  bucket: string;
  sizeBytes: number;
  etag?: string;
}

export class StorageService {
  private s3: S3Client | null = null;
  private bucket: string;

  constructor() {
    this.bucket = CONFIG.B2_BUCKET_NAME ?? '';

    if (CONFIG.B2_ENDPOINT && CONFIG.B2_KEY_ID && CONFIG.B2_APP_KEY) {
      this.s3 = new S3Client({
        endpoint: CONFIG.B2_ENDPOINT,
        region: CONFIG.B2_REGION,
        credentials: {
          accessKeyId: CONFIG.B2_KEY_ID,
          secretAccessKey: CONFIG.B2_APP_KEY,
        },
        // B2 works with both path-style and virtual-hosted-style URLs,
        // but path-style is more reliable across tools and reverse proxies.
        forcePathStyle: true,
        // AWS SDK v3.729.0+ sends x-amz-checksum-crc32 by default.
        // B2 added support for this header in July 2025, but we set
        // WHEN_REQUIRED for maximum compatibility with any B2 region.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }

    container.logger.debug(
      `[StorageService] endpoint=${CONFIG.B2_ENDPOINT ?? 'none'}, configured=${this.isConfigured}`
    );
  }

  /** Check if storage is configured and available. */
  get isConfigured(): boolean {
    return this.s3 !== null && this.bucket.length > 0;
  }

  /**
   * Generate a presigned upload URL for direct client-to-B2 uploads.
   *
   * The client performs a PUT request to the returned URL with the file body
   * and a `Content-Type` header matching `contentType`. The `Content-Length`
   * header is set by the browser/HTTP client automatically on the actual PUT
   * request - it cannot be enforced via the presigned URL itself.
   *
   * IMPORTANT: B2/S3 presigned PUT URLs cannot enforce file size limits server-side.
   * The maxSizeBytes parameter is accepted for API consistency and documentation
   * purposes, but actual size enforcement must happen at the application layer
   * (e.g., via WeightGate before generating the URL, or post-upload verification).
   *
   * B2 limits: max 5 GB per single-part upload, expiry up to 1 week.
   */
  async generateUploadUrl(
    key: string,
    contentType: string,
    _maxSizeBytes: number,
    expiresInSeconds: number = 3600
  ): Promise<PresignedUpload> {
    if (!this.s3) throw new Error('Storage not configured');

    // Clamp expiry to B2's maximum of 1 week
    const expiry = Math.min(expiresInSeconds, B2_MAX_PRESIGN_EXPIRY_SECONDS);

    // Note: ContentLength is intentionally NOT set on the presigned command.
    // S3 presigned URLs do not enforce ContentLength server-side; the actual
    // Content-Length is determined by the client's PUT request body.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: expiry,
    });

    return {
      uploadUrl,
      key,
      expiresAt: new Date(Date.now() + expiry * 1000),
    };
  }

  /**
   * Generate a presigned download URL for time-limited viewing.
   *
   * B2 limit: expiry up to 1 week (604800 seconds).
   */
  async generateViewUrl(key: string, expiresInSeconds: number = 900): Promise<string> {
    if (!this.s3) throw new Error('Storage not configured');

    const expiry = Math.min(expiresInSeconds, B2_MAX_PRESIGN_EXPIRY_SECONDS);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn: expiry,
    });
  }

  /**
   * Generate a presigned download URL with Content-Disposition: attachment.
   *
   * Forces the browser to download the file rather than display it inline.
   */
  async generateDownloadUrl(
    key: string,
    filename: string,
    expiresInSeconds: number = 900
  ): Promise<string> {
    if (!this.s3) throw new Error('Storage not configured');

    const expiry = Math.min(expiresInSeconds, B2_MAX_PRESIGN_EXPIRY_SECONDS);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn: expiry,
    });
  }

  /**
   * Server-side upload for message snapshots and small files.
   *
   * For files uploaded server-side, ContentLength is set from the buffer
   * length so B2 can validate the upload integrity.
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    if (!this.s3) throw new Error('Storage not configured');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    });

    const result = await this.s3.send(command);

    return {
      key,
      bucket: this.bucket,
      sizeBytes: buffer.length,
      etag: result.ETag,
    };
  }

  /**
   * Download a file from storage to a local path.
   * Used by the export system to gather evidence files into a ZIP.
   */
  async downloadFile(key: string, destPath: string): Promise<void> {
    if (!this.s3) throw new Error('Storage not configured');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3.send(command);
    if (!response.Body) throw new Error('Empty response body');

    const writeStream = createWriteStream(destPath);
    await pipeline(response.Body as Readable, writeStream);
  }

  /**
   * Download a file from storage to a buffer.
   * Used by watermarking service to process images in memory.
   */
  async downloadToBuffer(key: string): Promise<Buffer> {
    if (!this.s3) throw new Error('Storage not configured');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3.send(command);
    if (!response.Body) throw new Error('Empty response body');

    // Collect stream into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Upload a readable stream to storage.
   * Used by the export system to upload ZIP archives.
   */
  async uploadStream(key: string, stream: Readable, contentType: string): Promise<UploadResult> {
    if (!this.s3) throw new Error('Storage not configured');

    // Collect stream into buffer for S3 PutObject
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return this.uploadBuffer(key, buffer, contentType);
  }

  /**
   * Verify that a file exists in storage.
   *
   * Note: B2 ETags are MD5 hashes for single-part uploads, not SHA-256.
   * Our evidence integrity is verified separately via HMAC signatures
   * using the SHA-256 hash computed client-side and confirmed server-side.
   */
  async verifyUpload(key: string): Promise<boolean> {
    if (!this.s3) throw new Error('Storage not configured');

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const result = await this.s3.send(command);
      return !!result.ContentLength && result.ContentLength > 0;
    } catch {
      return false;
    }
  }

  /**
   * Build an organized storage key for evidence files.
   * Pattern: guilds/{guildId}/cases/{caseNumber}/evidence/{evidenceId}/{filename}
   */
  static buildKey(
    guildId: string,
    caseNumber: number,
    evidenceId: string,
    filename: string
  ): string {
    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `guilds/${guildId}/cases/${caseNumber}/evidence/${evidenceId}/${safeName}`;
  }

  /**
   * Build a storage key for message snapshot media.
   * Pattern: guilds/{guildId}/snapshots/{snapshotId}/media/{filename}
   */
  static buildSnapshotMediaKey(guildId: string, snapshotId: string, filename: string): string {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `guilds/${guildId}/snapshots/${snapshotId}/media/${safeName}`;
  }
}

export const storageService = new StorageService();
