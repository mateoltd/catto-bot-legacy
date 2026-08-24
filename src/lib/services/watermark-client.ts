/**
 * Client for the Rust watermark microservice.
 * Falls back to local Sharp-based watermarking if the service is unavailable.
 */

import { Buffer } from 'node:buffer';
import { checkRustServiceHealth, type RustServiceHealth } from './rust-service-health.js';

// Node.js >= 18 globals used: fetch, AbortController, FormData, Blob
/* global AbortController, fetch, FormData, Blob */

const WATERMARK_SERVICE_URL = process.env.WATERMARK_SERVICE_URL || 'http://localhost:3847';
const SERVICE_TIMEOUT = 10_000; // 10 seconds

export type OutputFormat = 'png' | 'jpeg' | 'webp';

interface WatermarkResult {
  buffer: Buffer;
  usedRustService: boolean;
}

class WatermarkClient {
  private serviceAvailable: boolean | null = null;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 60_000; // 1 minute

  /**
   * Check the Rust watermark service and update the availability cache.
   */
  async checkHealth(): Promise<RustServiceHealth> {
    const health = await checkRustServiceHealth(WATERMARK_SERVICE_URL);
    this.serviceAvailable = health.ok;
    this.lastHealthCheck = Date.now();
    return health;
  }

  /**
   * Check if the Rust watermark service is available.
   */
  async isServiceAvailable(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if recent
    if (this.serviceAvailable !== null && now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.serviceAvailable;
    }

    return (await this.checkHealth()).ok;
  }

  /**
   * Apply watermark using the Rust microservice.
   * Throws if the service is unavailable or returns an error.
   */
  async applyWatermark(
    imageBuffer: Buffer,
    text: string,
    format: OutputFormat = 'png'
  ): Promise<Buffer> {
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer]), 'image');
    formData.append('text', text);
    formData.append('format', format);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT);

    try {
      const response = await fetch(`${WATERMARK_SERVICE_URL}/watermark`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
          error?: string;
        };
        throw new Error(`Watermark service error: ${errorData.error || response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Apply watermark with automatic fallback to Sharp if Rust service is unavailable.
   */
  async applyWatermarkWithFallback(
    imageBuffer: Buffer,
    text: string,
    format: OutputFormat = 'png'
  ): Promise<WatermarkResult> {
    // Try Rust service first
    if (await this.isServiceAvailable()) {
      try {
        const buffer = await this.applyWatermark(imageBuffer, text, format);
        return { buffer, usedRustService: true };
      } catch {
        // Fall through to Sharp fallback
        this.serviceAvailable = false;
      }
    }

    // Fallback to Sharp
    const buffer = await this.applyWatermarkSharp(imageBuffer, text, format);
    return { buffer, usedRustService: false };
  }

  /**
   * Sharp-based fallback watermarking (original implementation).
   */
  private async applyWatermarkSharp(
    buffer: Buffer,
    text: string,
    format: OutputFormat
  ): Promise<Buffer> {
    // Dynamic import to avoid loading Sharp if Rust service is available
    const sharp = (await import('sharp')).default;

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width ?? 800;
    const height = metadata.height ?? 600;

    // Create SVG watermark
    const fontSize = Math.max(14, Math.min(width, height) / 30);
    const padding = fontSize;
    const escapedText = this.escapeXml(text);
    const timestamp = new Date().toISOString().split('T')[0];

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="text-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
            <feOffset in="blur" dx="1" dy="1" result="offsetBlur" />
            <feMerge>
              <feMergeNode in="offsetBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>
          .watermark {
            fill: rgba(255, 255, 255, 0.7);
            font-size: ${fontSize}px;
            font-family: sans-serif;
          }
        </style>
        <text x="${padding}" y="${height - padding}" class="watermark" filter="url(#text-shadow)">
          ${escapedText} | ${timestamp}
        </text>
      </svg>
    `;

    const svgBuffer = Buffer.from(svg);

    // Determine output format
    let sharpFormat: 'png' | 'jpeg' | 'webp' = 'png';
    if (format === 'jpeg') {
      sharpFormat = 'jpeg';
    } else if (format === 'webp') {
      sharpFormat = 'webp';
    }

    return image
      .composite([{ input: svgBuffer, gravity: 'southwest' }])
      .toFormat(sharpFormat)
      .toBuffer();
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const watermarkClient = new WatermarkClient();
