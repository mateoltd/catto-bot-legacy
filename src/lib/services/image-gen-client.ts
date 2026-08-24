/**
 * Image Generation Client
 * Communicates with the Rust image-gen-rs microservice.
 */

import { Buffer } from 'node:buffer';
import type { BonkImageData, RankCardData, LeaderboardCardData } from './image-gen-types.js';
import { checkRustServiceHealth, type RustServiceHealth } from './rust-service-health.js';

/* global AbortController, fetch */

const IMAGE_GEN_SERVICE_URL = process.env.IMAGE_GEN_SERVICE_URL || 'http://localhost:3848';
const SERVICE_TIMEOUT = 15_000; // 15 seconds

class ImageGenClient {
  /**
   * Check if the Rust image generation service is available.
   */
  async checkHealth(): Promise<RustServiceHealth> {
    return checkRustServiceHealth(IMAGE_GEN_SERVICE_URL);
  }

  /**
   * Generate a bonk image using the Rust microservice.
   */
  async generateBonk(data: BonkImageData): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT);

    try {
      const response = await fetch(`${IMAGE_GEN_SERVICE_URL}/bonk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message: string;
        try {
          const parsed = JSON.parse(body) as { error?: string };
          message = parsed.error || response.statusText;
        } catch {
          message = body || response.statusText;
        }
        throw new Error(`Image gen service error (${response.status}): ${message}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Generate a rank card using the Rust microservice.
   */
  async generateRankCard(data: RankCardData): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT);

    try {
      const response = await fetch(`${IMAGE_GEN_SERVICE_URL}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message: string;
        try {
          const parsed = JSON.parse(body) as { error?: string };
          message = parsed.error || response.statusText;
        } catch {
          message = body || response.statusText;
        }
        throw new Error(`Image gen service error (${response.status}): ${message}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Generate a leaderboard card using the Rust microservice.
   */
  async generateLeaderboard(data: LeaderboardCardData): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT);

    try {
      const response = await fetch(`${IMAGE_GEN_SERVICE_URL}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message: string;
        try {
          const parsed = JSON.parse(body) as { error?: string };
          message = parsed.error || response.statusText;
        } catch {
          message = body || response.statusText;
        }
        throw new Error(`Image gen service error (${response.status}): ${message}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const imageGenClient = new ImageGenClient();
