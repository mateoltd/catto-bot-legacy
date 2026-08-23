/**
 * Evidence System - TypeScript interfaces for evidence data shapes
 */

import type { EvidenceType, EvidenceStatus } from '@prisma/client';
import type { APIEmbed } from 'discord.js';

/** Serialized message attachment for snapshots */
export interface SerializedAttachment {
  url: string;
  proxyUrl?: string;
  filename: string;
  size: number;
  contentType: string | null;
  storageKey?: string; // B2 key if archived
  archiveFailed?: boolean; // true if B2 archival failed
}

/** Serialized sticker for snapshots */
export interface SerializedSticker {
  id: string;
  name: string;
  format: string;
  url: string;
}

/** Serialized reaction for snapshots */
export interface SerializedReaction {
  emoji: string;
  count: number;
  users?: string[]; // User IDs who reacted
}

/** Individual message entry in a snapshot */
export interface MessageSnapshotEntry {
  messageId: string;
  authorId: string;
  authorTag: string;
  authorAvatarUrl: string;
  content: string;
  embeds: APIEmbed[];
  attachments: SerializedAttachment[];
  stickers: SerializedSticker[];
  reactions: SerializedReaction[];
  messageUrl: string;
  createdAt: string; // ISO
  editedAt: string | null; // ISO
}

/** Parameters for initiating an upload */
export interface UploadInitParams {
  guildId: string;
  caseNumber: number;
  uploadedById: string;
  uploadedByTag: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
  tags?: string[];
}

/** Result of initiating an upload */
export interface UploadInitResult {
  evidenceId: string;
  uploadUrl: string;
  uploadFields: Record<string, string>;
}

/** Parameters for adding URL evidence */
export interface UrlEvidenceParams {
  guildId: string;
  caseNumber: number;
  uploadedById: string;
  uploadedByTag: string;
  url: string;
  type: 'URL' | 'DISCORD_URL';
  description?: string;
  tags?: string[];
}

/** Parameters for capturing a message range */
export interface CaptureParams {
  guildId: string;
  channelId: string;
  firstMessageId: string;
  lastMessageId?: string;
  messageCount?: number;
  capturedById: string;
  capturedByTag: string;
  /** If omitted, only a snapshot is created (no evidence record). */
  caseNumber?: number;
  deleteAfterCapture: boolean;
}

/** Parameters for amending evidence */
export interface AmendParams {
  evidenceId: string;
  amendedById: string;
  amendedByTag: string;
  action: string;
  newValue?: string;
  reason?: string;
}

/** Evidence summary for Discord embeds */
export interface EvidenceSummary {
  total: number;
  byType: Partial<Record<EvidenceType, number>>;
  byStatus: Partial<Record<EvidenceStatus, number>>;
  totalSizeBytes: number;
  latestAt: Date | null;
  hasWeakEvidenceOnly: boolean; // Only DISCORD_URL types
}

/** MIME type to EvidenceType mapping */
export function mimeToEvidenceType(mimeType: string): EvidenceType {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

/** Check if a URL is a Discord message URL */
export function isDiscordUrl(url: string): boolean {
  return /^https?:\/\/(canary\.|ptb\.)?discord(app)?\.com\/channels\/\d+\/\d+\/\d+/.test(url);
}
