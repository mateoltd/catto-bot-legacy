/**
 * Signing Service - HMAC + SHA-256 for evidence integrity
 *
 * Provides content hashing and HMAC signing to ensure evidence
 * immutability and authenticity.
 */

import { createHash, createHmac } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import { container } from '@sapphire/framework';
import { CONFIG } from '#config.js';

export interface SigningMetadata {
  evidenceId: string;
  guildId: string;
  caseId: string;
  uploadedById: string;
  timestamp: string; // ISO
}

export class SigningService {
  private readonly hmacSecret: string;

  constructor() {
    this.hmacSecret = CONFIG.EVIDENCE_HMAC_SECRET ?? '';

    // Warn if storage appears configured but signing is not
    if (!this.isConfigured && CONFIG.B2_ENDPOINT && CONFIG.B2_KEY_ID) {
      // Use setTimeout to ensure container.logger is available after initialization
      setTimeout(() => {
        container.logger.warn(
          '[SigningService] B2 storage is configured but EVIDENCE_HMAC_SECRET is missing or too short (min 32 chars). ' +
            'Evidence uploads will not have integrity signatures. Set EVIDENCE_HMAC_SECRET in production.'
        );
      }, 0);
    }
  }

  /** Check if signing is configured (HMAC secret is at least 32 characters). */
  get isConfigured(): boolean {
    return this.hmacSecret.length >= 32;
  }

  /**
   * Compute SHA-256 hash of a buffer.
   */
  static sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Compute SHA-256 hash of a readable stream.
   */
  static async sha256Stream(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Sign a content hash with HMAC-SHA256 using the server secret.
   * The HMAC input includes both the content hash and metadata
   * to bind the signature to a specific evidence record.
   */
  sign(contentHash: string, metadata: SigningMetadata): string {
    if (!this.isConfigured) {
      throw new Error('SigningService: EVIDENCE_HMAC_SECRET not configured');
    }

    const input = this.buildHmacInput(contentHash, metadata);
    return createHmac('sha256', this.hmacSecret).update(input).digest('hex');
  }

  /**
   * Verify an HMAC signature against a content hash and metadata.
   */
  verify(contentHash: string, metadata: SigningMetadata, signature: string): boolean {
    if (!this.isConfigured) return false;

    try {
      const expected = this.sign(contentHash, metadata);
      // Constant-time comparison
      if (expected.length !== signature.length) return false;

      let result = 0;
      for (let i = 0; i < expected.length; i++) {
        result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
      }
      return result === 0;
    } catch {
      return false;
    }
  }

  /**
   * Build signing metadata from an evidence record.
   */
  static buildMetadata(evidence: {
    id: string;
    guildId: string;
    caseId: string;
    uploadedById: string;
    createdAt: Date;
  }): SigningMetadata {
    return {
      evidenceId: evidence.id,
      guildId: evidence.guildId,
      caseId: evidence.caseId,
      uploadedById: evidence.uploadedById,
      timestamp: evidence.createdAt.toISOString(),
    };
  }

  /**
   * Build the HMAC input string from content hash + metadata.
   * Format: contentHash|evidenceId|guildId|caseId|uploadedById|timestamp
   */
  private buildHmacInput(contentHash: string, metadata: SigningMetadata): string {
    return [
      contentHash,
      metadata.evidenceId,
      metadata.guildId,
      metadata.caseId,
      metadata.uploadedById,
      metadata.timestamp,
    ].join('|');
  }
}

export const signingService = new SigningService();
