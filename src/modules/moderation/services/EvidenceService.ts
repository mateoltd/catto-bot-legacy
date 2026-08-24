/**
 * Evidence Service - Core business logic for the evidence management system
 *
 * Handles file uploads, URL evidence, message snapshot capture,
 * integrity verification, and evidence queries.
 */

import { container } from "@sapphire/framework";
import {
  Prisma,
  type Evidence,
  type EvidenceAmendment,
  type MessageSnapshot,
} from "@prisma/client";
import type { Guild, TextChannel, Message } from "discord.js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import axios from "axios";
import { storageService, StorageService } from "#lib/storage/StorageService.js";
import { signingService, SigningService } from "#lib/storage/SigningService.js";
import { WeightGate } from "#lib/validation/WeightGate.js";
import { CONFIG } from "#config.js";
import type {
  UploadInitParams,
  UploadInitResult,
  UrlEvidenceParams,
  CaptureParams,
  AmendParams,
  EvidenceSummary,
  MessageSnapshotEntry,
  SerializedAttachment,
  SerializedSticker,
  SerializedReaction,
} from "../domain/evidence-types.js";
import { mimeToEvidenceType, isDiscordUrl } from "../domain/evidence-types.js";
import { fetchOGData } from "#lib/utils/ogFetcher.js";
import { publish, ModEventChannels } from "#lib/redis.js";

export class EvidenceService {
  // ─── Upload Flow ───

  /**
   * Step 1: Initiate upload — creates a PENDING evidence record and returns a presigned upload URL.
   */
  async initiateUpload(params: UploadInitParams): Promise<UploadInitResult> {
    // Find the case
    const modCase = await container.prisma.modCase.findFirst({
      where: { guildId: params.guildId, caseNumber: params.caseNumber },
    });
    if (!modCase)
      throw new Error(
        `Case #${params.caseNumber} not found in guild ${params.guildId}`,
      );

    // Determine evidence type from MIME
    const type = mimeToEvidenceType(params.mimeType);

    // Create PENDING evidence record
    const evidence = await container.prisma.evidence.create({
      data: {
        guildId: params.guildId,
        caseId: modCase.id,
        caseNumber: params.caseNumber,
        uploadedById: params.uploadedById,
        uploadedByTag: params.uploadedByTag,
        type,
        status: "PENDING",
        originalFilename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        storageBucket: CONFIG.B2_BUCKET_NAME ?? null,
        description: params.description,
        tags: params.tags ?? [],
      },
    });

    // Generate storage key
    const storageKey = StorageService.buildKey(
      params.guildId,
      params.caseNumber,
      evidence.id,
      params.filename,
    );

    // Update evidence with storage key
    await container.prisma.evidence.update({
      where: { id: evidence.id },
      data: { storageKey },
    });

    // Generate presigned upload URL
    let uploadUrl = "";
    const uploadFields: Record<string, string> = {};

    if (storageService.isConfigured) {
      const presigned = await storageService.generateUploadUrl(
        storageKey,
        params.mimeType,
        params.sizeBytes,
      );
      uploadUrl = presigned.uploadUrl;
    }

    container.logger.debug(
      `[EvidenceService.initiateUpload] evidenceId=${evidence.id}, storageKey=${storageKey}, hasUploadUrl=${!!uploadUrl}`,
    );

    return {
      evidenceId: evidence.id,
      uploadUrl,
      uploadFields,
    };
  }

  /**
   * Step 2: Confirm upload — verifies hash, signs, and sets status to VERIFIED.
   */
  async confirmUpload(
    evidenceId: string,
    contentHash: string,
  ): Promise<Evidence> {
    const evidence = await container.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });
    if (!evidence) throw new Error("Evidence not found");
    if (evidence.status !== "PENDING" && evidence.status !== "PROCESSING") {
      throw new Error(
        `Evidence is in ${evidence.status} state, cannot confirm`,
      );
    }

    // Verify file exists in storage
    if (evidence.storageKey) {
      if (!storageService.isConfigured) {
        throw new Error(
          "Storage is not configured but evidence has a storage key — cannot verify upload",
        );
      }
      const exists = await storageService.verifyUpload(evidence.storageKey);
      container.logger.debug(
        `[EvidenceService.confirmUpload] storageConfigured=${storageService.isConfigured}, verifyResult=${exists}`,
      );
      if (!exists) throw new Error("File not found in storage");
    }

    // Sign the content
    let hmacSignature: string | null = null;
    if (signingService.isConfigured) {
      const metadata = SigningService.buildMetadata(evidence);
      hmacSignature = signingService.sign(contentHash, metadata);
    }

    // Record upload weight
    if (evidence.sizeBytes) {
      await WeightGate.recordUpload(
        evidence.uploadedById,
        evidence.guildId,
        evidence.sizeBytes,
      );
    }

    // Update to VERIFIED
    const confirmed = await container.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        status: "VERIFIED",
        contentHash,
        hmacSignature,
      },
    });

    // Publish real-time event
    await publish(ModEventChannels.MOD_EVENTS(confirmed.guildId), {
      type: "evidence:created",
      guildId: confirmed.guildId,
      caseNumber: confirmed.caseNumber,
      evidenceId: confirmed.id,
    }).catch(() => {});

    return confirmed;
  }

  // ─── URL Evidence ───

  /**
   * Add URL-type evidence to a case.
   * DISCORD_URL type is marked as "weak evidence" — if a case has only
   * DISCORD_URL evidence, the dashboard will show a warning.
   */
  async addUrlEvidence(params: UrlEvidenceParams): Promise<Evidence> {
    const modCase = await container.prisma.modCase.findFirst({
      where: { guildId: params.guildId, caseNumber: params.caseNumber },
    });
    if (!modCase) throw new Error(`Case #${params.caseNumber} not found`);

    // Auto-detect Discord URLs
    const type =
      params.type === "URL" && isDiscordUrl(params.url)
        ? "DISCORD_URL"
        : params.type;

    // Fetch OG metadata for enrichment
    let metadata: Record<string, unknown> | undefined;

    if (type === "DISCORD_URL") {
      // Attempt to resolve Discord message content
      try {
        const match = params.url.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
        if (match) {
          const [, , channelId, messageId] = match;
          const guild = container.client.guilds.cache.get(params.guildId);
          if (guild) {
            const channel = await guild.channels
              .fetch(channelId!)
              .catch(() => null);
            if (channel?.isTextBased()) {
              const msg = await (
                channel as import("discord.js").TextChannel
              ).messages
                .fetch(messageId!)
                .catch(() => null);
              if (msg) {
                metadata = {
                  og: {
                    title: msg.author.tag,
                    description: msg.content.slice(0, 200) || undefined,
                    siteName: "Discord",
                  },
                };
              }
            }
          }
        }
      } catch {
        // Fail silently — enrichment is optional
      }
    } else {
      const ogData = await fetchOGData(params.url);
      if (ogData) {
        metadata = { og: ogData };
      }
    }

    const urlEvidence = await container.prisma.evidence.create({
      data: {
        guildId: params.guildId,
        caseId: modCase.id,
        caseNumber: params.caseNumber,
        uploadedById: params.uploadedById,
        uploadedByTag: params.uploadedByTag,
        type,
        status: "VERIFIED", // URLs are immediately verified
        url: params.url,
        description: params.description,
        metadata: (metadata ?? undefined) as
          | import("@prisma/client").Prisma.InputJsonValue
          | undefined,
        tags: params.tags ?? [],
      },
    });

    // Publish real-time event
    await publish(ModEventChannels.MOD_EVENTS(params.guildId), {
      type: "evidence:created",
      guildId: params.guildId,
      caseNumber: params.caseNumber,
      evidenceId: urlEvidence.id,
    }).catch(() => {});

    return urlEvidence;
  }

  // ─── Message Snapshot ───

  /**
   * Capture a range of messages as a snapshot.
   * If caseNumber is provided, also creates an Evidence record linked to that case.
   * If caseNumber is omitted, only creates the snapshot (for later linking via createEvidenceFromSnapshot).
   */
  async captureMessageRange(
    guild: Guild,
    params: CaptureParams,
  ): Promise<{ snapshot: MessageSnapshot; evidence?: Evidence }> {
    const channel = await guild.channels.fetch(params.channelId);
    if (!channel?.isTextBased())
      throw new Error("Channel not found or not text-based");

    const textChannel = channel as TextChannel;

    // Fetch messages based on capture mode
    let collected: Map<string, Message>;

    if (params.messageCount && params.messageCount > 0) {
      const firstMsg = await textChannel.messages.fetch(params.firstMessageId);
      collected = new Map([[firstMsg.id, firstMsg]]);

      if (params.messageCount > 1) {
        const afterMessages = await textChannel.messages.fetch({
          after: params.firstMessageId,
          limit: Math.min(params.messageCount - 1, 99),
        });
        for (const [id, msg] of afterMessages) {
          collected.set(id, msg);
        }
      }
    } else if (params.lastMessageId) {
      const firstMsg = await textChannel.messages.fetch(params.firstMessageId);
      collected = new Map([[firstMsg.id, firstMsg]]);

      const afterMessages = await textChannel.messages.fetch({
        after: params.firstMessageId,
        limit: 100,
      });
      for (const [id, msg] of afterMessages) {
        if (id <= params.lastMessageId && id >= params.firstMessageId) {
          collected.set(id, msg);
        }
      }
    } else {
      const msg = await textChannel.messages.fetch(params.firstMessageId);
      collected = new Map([[msg.id, msg]]);
    }

    let sortedMessages = [...collected.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp,
    );

    if (sortedMessages.length === 0)
      throw new Error("No messages found in the specified range");

    // Cap the number of messages to prevent memory issues with large snapshots
    if (sortedMessages.length > CONFIG.MAX_SNAPSHOT_MESSAGES) {
      container.logger.warn(
        `[EvidenceService] Snapshot capped from ${sortedMessages.length} to ${CONFIG.MAX_SNAPSHOT_MESSAGES} messages`,
      );
      sortedMessages = sortedMessages.slice(0, CONFIG.MAX_SNAPSHOT_MESSAGES);
    }

    // Look up case if caseNumber provided
    let modCase = null;
    if (params.caseNumber != null) {
      modCase = await container.prisma.modCase.findFirst({
        where: { guildId: params.guildId, caseNumber: params.caseNumber },
      });
      if (!modCase) throw new Error(`Case #${params.caseNumber} not found`);
    }

    // Serialize messages
    const snapshotEntries: MessageSnapshotEntry[] = [];
    const mediaStorageKeys: string[] = [];

    // Generate a stable ID prefix for media storage keys
    // This ensures all attachments for this snapshot share a consistent path
    const mediaPrefix = randomUUID();

    for (const msg of sortedMessages) {
      const attachments: SerializedAttachment[] = [];

      for (const [, attachment] of msg.attachments) {
        const serialized: SerializedAttachment = {
          url: attachment.url,
          proxyUrl: attachment.proxyURL,
          filename: attachment.name ?? "unknown",
          size: attachment.size,
          contentType: attachment.contentType,
        };

        if (storageService.isConfigured) {
          try {
            const response = await axios.get(attachment.url, {
              responseType: "arraybuffer",
              timeout: 30000, // 30 second timeout to prevent hanging on slow/malicious URLs
            });
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              const key = StorageService.buildSnapshotMediaKey(
                params.guildId,
                mediaPrefix,
                attachment.name ?? `attachment_${attachment.id}`,
              );
              await storageService.uploadBuffer(
                key,
                buffer,
                attachment.contentType ?? "application/octet-stream",
              );
              serialized.storageKey = key;
            }
          } catch (archiveError) {
            serialized.archiveFailed = true;
            container.logger.warn(
              `Failed to archive attachment ${attachment.id}:`,
              archiveError,
            );
          }
        }

        if (serialized.storageKey && !serialized.archiveFailed) {
          mediaStorageKeys.push(serialized.storageKey);
        }

        attachments.push(serialized);
      }

      const stickers: SerializedSticker[] = [...msg.stickers.values()].map(
        (s) => ({
          id: s.id,
          name: s.name,
          format: s.format.toString(),
          url: s.url,
        }),
      );

      const reactions: SerializedReaction[] = [
        ...msg.reactions.cache.values(),
      ].map((r) => ({
        emoji: r.emoji.toString(),
        count: r.count,
      }));

      snapshotEntries.push({
        messageId: msg.id,
        authorId: msg.author.id,
        authorTag: msg.author.tag,
        authorAvatarUrl: msg.author.displayAvatarURL(),
        content: msg.content,
        embeds: msg.embeds.map((e) => e.toJSON()),
        attachments,
        stickers,
        reactions,
        messageUrl: msg.url,
        createdAt: msg.createdAt.toISOString(),
        editedAt: msg.editedAt?.toISOString() ?? null,
      });
    }

    // Compute integrity hash
    const snapshotJson = JSON.stringify(snapshotEntries);
    const contentHash = SigningService.sha256(Buffer.from(snapshotJson));

    // Create MessageSnapshot first (HMAC signature added after evidence creation)
    const snapshot = await container.prisma.messageSnapshot.create({
      data: {
        guildId: params.guildId,
        channelId: params.channelId,
        capturedById: params.capturedById,
        capturedByTag: params.capturedByTag,
        firstMessageId: params.firstMessageId,
        lastMessageId: params.lastMessageId ?? null,
        messageCount: sortedMessages.length,
        snapshotData:
          snapshotEntries as unknown as import("@prisma/client").Prisma.InputJsonValue,
        mediaStorageKeys:
          mediaStorageKeys.length > 0 ? mediaStorageKeys : undefined,
        contentHash,
        hmacSignature: "", // Will be updated after evidence creation if applicable
      },
    });

    // Create Evidence record only if we have a case
    let evidence: Evidence | undefined;
    if (modCase) {
      // Create the evidence record first to get the real ID
      evidence = await container.prisma.evidence.create({
        data: {
          guildId: params.guildId,
          caseId: modCase.id,
          caseNumber: params.caseNumber!,
          uploadedById: params.capturedById,
          uploadedByTag: params.capturedByTag,
          type: "MESSAGE_SNAPSHOT",
          status: "VERIFIED",
          snapshotId: snapshot.id,
          contentHash,
          hmacSignature: "", // Placeholder, will be updated below
          description: `Message snapshot: ${sortedMessages.length} message(s) from #${textChannel.name}`,
        },
      });

      // Now compute HMAC with the real evidence ID and update
      if (signingService.isConfigured) {
        const hmacSignature = signingService.sign(contentHash, {
          evidenceId: evidence.id,
          guildId: params.guildId,
          caseId: modCase.id,
          uploadedById: params.capturedById,
          timestamp: evidence.createdAt.toISOString(),
        });

        // Update both evidence and snapshot with the correct signature
        [evidence] = await Promise.all([
          container.prisma.evidence.update({
            where: { id: evidence.id },
            data: { hmacSignature },
          }),
          container.prisma.messageSnapshot.update({
            where: { id: snapshot.id },
            data: { hmacSignature },
          }),
        ]);
      }
    }

    // Delete original messages if requested
    if (params.deleteAfterCapture && sortedMessages.length > 0) {
      try {
        if (sortedMessages.length === 1 && sortedMessages[0]) {
          await sortedMessages[0].delete();
        } else {
          const messageIds = sortedMessages.map((m) => m.id);
          await textChannel.bulkDelete(messageIds).catch(async () => {
            for (const msg of sortedMessages) {
              await msg.delete().catch(() => {});
            }
          });
        }
      } catch {
        container.logger.warn("Failed to delete captured messages");
      }
    }

    return { snapshot, evidence };
  }

  /**
   * Create an evidence record from an existing snapshot, linking it to a case.
   * Used after a mod action creates the case.
   */
  async createEvidenceFromSnapshot(
    snapshotId: string,
    caseId: string,
    caseNumber: number,
  ): Promise<Evidence> {
    const snapshot = await container.prisma.messageSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) throw new Error("Snapshot not found");

    const guild = container.client.guilds.cache.get(snapshot.guildId);
    const channelName = guild
      ? ((await guild.channels.fetch(snapshot.channelId).catch(() => null))
          ?.name ?? "unknown")
      : "unknown";

    const evidence = await container.prisma.evidence.create({
      data: {
        guildId: snapshot.guildId,
        caseId,
        caseNumber,
        uploadedById: snapshot.capturedById,
        uploadedByTag: snapshot.capturedByTag,
        type: "MESSAGE_SNAPSHOT",
        status: "VERIFIED",
        snapshotId: snapshot.id,
        contentHash: snapshot.contentHash,
        hmacSignature: snapshot.hmacSignature,
        description: `Message snapshot: ${snapshot.messageCount} message(s) from #${channelName}`,
      },
    });

    // Publish real-time event
    await publish(ModEventChannels.MOD_EVENTS(snapshot.guildId), {
      type: "evidence:created",
      guildId: snapshot.guildId,
      caseNumber,
      evidenceId: evidence.id,
    }).catch(() => {});

    return evidence;
  }

  // ─── Queries ───

  /**
   * Get all evidence for a case.
   */
  async getEvidenceForCase(
    guildId: string,
    caseNumber: number,
  ): Promise<Evidence[]> {
    return container.prisma.evidence.findMany({
      where: { guildId, caseNumber },
      orderBy: { createdAt: "asc" },
      include: { snapshot: true },
    });
  }

  /**
   * Get paginated evidence for an entire guild with optional filters.
   */
  async getEvidenceForGuild(
    guildId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      caseNumber?: number;
      tags?: string[];
    },
  ): Promise<{
    evidence: Evidence[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { guildId };
    if (options.type) where.type = options.type;
    if (options.status) where.status = options.status;
    if (options.caseNumber) where.caseNumber = options.caseNumber;
    if (options.tags && options.tags.length > 0)
      where.tags = { hasSome: options.tags };

    const [evidence, total] = await Promise.all([
      container.prisma.evidence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { snapshot: true },
      }),
      container.prisma.evidence.count({ where }),
    ]);

    return {
      evidence,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * NH-5: Full-text search for evidence.
   * Uses PostgreSQL tsvector for efficient text search.
   */
  async searchEvidence(
    guildId: string,
    searchQuery: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      caseNumber?: number;
      tags?: string[];
    } = {},
  ): Promise<{
    evidence: Evidence[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!searchQuery || searchQuery.length < 2) {
      return { evidence: [], total: 0, page: 1, totalPages: 1 };
    }

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;

    // Keep search and facets on the database. The expression is mirrored by a
    // GIN index so a six-figure evidence corpus is never scanned in the browser.
    const filters: Prisma.Sql[] = [Prisma.sql`e."guildId" = ${guildId}`];
    if (options.type) filters.push(Prisma.sql`e.type::text = ${options.type}`);
    if (options.status)
      filters.push(Prisma.sql`e.status::text = ${options.status}`);
    if (options.caseNumber)
      filters.push(Prisma.sql`e."caseNumber" = ${options.caseNumber}`);
    if (options.tags?.length)
      filters.push(Prisma.sql`e.tags && ${options.tags}::text[]`);

    const document = Prisma.sql`to_tsvector(
      'simple'::regconfig,
      COALESCE(e."originalFilename", '') || ' ' ||
      COALESCE(e.url, '') || ' ' ||
      COALESCE(e.description, '') || ' ' ||
      COALESCE(e."uploadedByTag", '')
    )`;
    const query = Prisma.sql`websearch_to_tsquery('simple'::regconfig, ${searchQuery})`;
    filters.push(Prisma.sql`${document} @@ ${query}`);
    const where = Prisma.join(filters, " AND ");

    type EvidenceWithSnapshotRaw = Omit<Evidence, "snapshot"> & {
      snapshot: Record<string, unknown> | null;
    };
    const rawResults = await container.prisma.$queryRaw<
      EvidenceWithSnapshotRaw[]
    >`
      SELECT e.*, row_to_json(s.*) as snapshot
      FROM evidence e
      LEFT JOIN message_snapshots s ON e."snapshotId" = s.id
      WHERE ${where}
      ORDER BY ts_rank(${document}, ${query}) DESC, e."createdAt" DESC, e.id DESC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const evidence = rawResults as unknown as Evidence[];

    const countResult = await container.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM evidence e
      WHERE ${where}
    `;
    const total = Number(countResult[0]?.count ?? 0);

    return {
      evidence,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get a single evidence item by ID.
   */
  async getEvidenceById(evidenceId: string): Promise<Evidence | null> {
    return container.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        snapshot: true,
        amendments: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  /**
   * Get amendment history for an evidence item.
   */
  async getEvidenceHistory(evidenceId: string): Promise<EvidenceAmendment[]> {
    return container.prisma.evidenceAmendment.findMany({
      where: { evidenceId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get evidence summary for a case (for embeds).
   */
  async getEvidenceSummary(
    guildId: string,
    caseNumber: number,
  ): Promise<EvidenceSummary> {
    const items = await container.prisma.evidence.findMany({
      where: { guildId, caseNumber },
      select: { type: true, status: true, sizeBytes: true, createdAt: true },
    });

    const byType: Partial<Record<string, number>> = {};
    const byStatus: Partial<Record<string, number>> = {};
    let totalSizeBytes = 0;
    let latestAt: Date | null = null;
    let hasNonDiscordUrl = false;

    for (const item of items) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
      totalSizeBytes += item.sizeBytes ?? 0;
      if (!latestAt || item.createdAt > latestAt) latestAt = item.createdAt;
      if (item.type !== "DISCORD_URL") hasNonDiscordUrl = true;
    }

    return {
      total: items.length,
      byType: byType as EvidenceSummary["byType"],
      byStatus: byStatus as EvidenceSummary["byStatus"],
      totalSizeBytes,
      latestAt,
      hasWeakEvidenceOnly: items.length > 0 && !hasNonDiscordUrl,
    };
  }

  // ─── Amendments ───

  /**
   * Add an amendment to an evidence item (append-only history).
   */
  async amendEvidence(params: AmendParams): Promise<EvidenceAmendment> {
    const evidence = await container.prisma.evidence.findUnique({
      where: { id: params.evidenceId },
    });
    if (!evidence) throw new Error("Evidence not found");

    // Record previous value based on action type
    let previousValue: string | undefined;
    if (params.action === "DESCRIPTION_UPDATED") {
      previousValue = JSON.stringify({ description: evidence.description });
    }

    const amendment = await container.prisma.evidenceAmendment.create({
      data: {
        evidenceId: params.evidenceId,
        amendedById: params.amendedById,
        amendedByTag: params.amendedByTag,
        action: params.action,
        previousValue,
        newValue: params.newValue,
        reason: params.reason,
      },
    });

    // Apply the amendment
    if (params.action === "DESCRIPTION_UPDATED" && params.newValue) {
      await container.prisma.evidence.update({
        where: { id: params.evidenceId },
        data: { description: params.newValue },
      });
    } else if (params.action === "FLAGGED") {
      await container.prisma.evidence.update({
        where: { id: params.evidenceId },
        data: { status: "FLAGGED" },
      });
    } else if (params.action === "UNFLAGGED") {
      await container.prisma.evidence.update({
        where: { id: params.evidenceId },
        data: { status: "VERIFIED" },
      });
    } else if (params.action === "TAGS_UPDATED" && params.newValue) {
      try {
        const tags = JSON.parse(params.newValue) as string[];

        // Validate tags
        const MAX_TAG_COUNT = 20;
        const MAX_TAG_LENGTH = 50;
        const TAG_PATTERN = /^[a-zA-Z0-9_-]+$/;

        if (!Array.isArray(tags)) {
          throw new Error("Tags must be an array");
        }
        if (tags.length > MAX_TAG_COUNT) {
          throw new Error(`Maximum ${MAX_TAG_COUNT} tags allowed`);
        }

        const validatedTags = tags
          .map((t) => String(t).trim().toLowerCase())
          .filter(
            (t) =>
              t.length > 0 && t.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(t),
          );

        await container.prisma.evidence.update({
          where: { id: params.evidenceId },
          data: { tags: validatedTags },
        });
      } catch {
        // Invalid JSON or validation failed, skip
      }
    }

    // Publish real-time event
    const eventType =
      params.action === "FLAGGED" || params.action === "UNFLAGGED"
        ? "evidence:status-changed"
        : "evidence:amended";
    await publish(ModEventChannels.MOD_EVENTS(evidence.guildId), {
      type: eventType,
      guildId: evidence.guildId,
      caseNumber: evidence.caseNumber,
      evidenceId: evidence.id,
      data: { action: params.action },
    }).catch(() => {});

    return amendment;
  }

  // ─── Video Timestamps (NH-4) ───

  /**
   * Add a timestamp annotation to video evidence.
   * Timestamps are stored in the metadata.timestamps array.
   */
  async addTimestamp(
    evidenceId: string,
    timestamp: {
      time: number; // seconds
      note: string;
      addedById: string;
      addedByTag: string;
    },
  ): Promise<Evidence> {
    const MAX_NOTE_LENGTH = 1000;

    if (
      typeof timestamp.time !== "number" ||
      isNaN(timestamp.time) ||
      timestamp.time < 0
    ) {
      throw new Error("Timestamp time must be a non-negative number");
    }

    const trimmedNote = timestamp.note.trim();
    if (!trimmedNote) {
      throw new Error("Timestamp note cannot be empty");
    }
    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      throw new Error(
        `Timestamp note exceeds maximum length of ${MAX_NOTE_LENGTH} characters`,
      );
    }
    timestamp = { ...timestamp, note: trimmedNote };

    const evidence = await container.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });
    if (!evidence) throw new Error("Evidence not found");

    if (evidence.type !== "VIDEO") {
      throw new Error("Timestamps can only be added to video evidence");
    }

    // Get existing timestamps or initialize
    const metadata = (evidence.metadata as Record<string, unknown>) ?? {};
    const timestamps =
      (metadata.timestamps as Array<{
        id: string;
        time: number;
        note: string;
        addedBy: string;
        addedByTag: string;
        createdAt: string;
      }>) ?? [];

    // Add new timestamp
    const newTimestamp = {
      id: randomUUID(),
      time: timestamp.time,
      note: timestamp.note,
      addedBy: timestamp.addedById,
      addedByTag: timestamp.addedByTag,
      createdAt: new Date().toISOString(),
    };
    timestamps.push(newTimestamp);

    // Sort by time
    timestamps.sort((a, b) => a.time - b.time);

    // Update evidence
    const updated = await container.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        metadata: {
          ...metadata,
          timestamps,
        } as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    // Create amendment record
    await container.prisma.evidenceAmendment.create({
      data: {
        evidenceId,
        amendedById: timestamp.addedById,
        amendedByTag: timestamp.addedByTag,
        action: "TIMESTAMP_ADDED",
        newValue: JSON.stringify(newTimestamp),
      },
    });

    return updated;
  }

  /**
   * Remove a timestamp from video evidence.
   */
  async removeTimestamp(
    evidenceId: string,
    timestampId: string,
    removedById: string,
    removedByTag: string,
  ): Promise<Evidence> {
    const evidence = await container.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });
    if (!evidence) throw new Error("Evidence not found");

    if (evidence.type !== "VIDEO") {
      throw new Error("Timestamps can only be removed from video evidence");
    }

    const metadata = (evidence.metadata as Record<string, unknown>) ?? {};
    const timestamps =
      (metadata.timestamps as Array<{
        id: string;
        time: number;
        note: string;
        addedBy: string;
        addedByTag: string;
        createdAt: string;
      }>) ?? [];

    const removedTimestamp = timestamps.find((t) => t.id === timestampId);
    if (!removedTimestamp) throw new Error("Timestamp not found");

    const filtered = timestamps.filter((t) => t.id !== timestampId);

    const updated = await container.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        metadata: {
          ...metadata,
          timestamps: filtered,
        } as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    // Create amendment record
    await container.prisma.evidenceAmendment.create({
      data: {
        evidenceId,
        amendedById: removedById,
        amendedByTag: removedByTag,
        action: "TIMESTAMP_REMOVED",
        previousValue: JSON.stringify(removedTimestamp),
      },
    });

    return updated;
  }

  // ─── View URLs ───

  /**
   * Generate a time-limited view URL for an evidence file.
   */
  async generateViewUrl(evidenceId: string): Promise<string> {
    const evidence = await container.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });
    if (!evidence) throw new Error("Evidence not found");

    if (evidence.url) return evidence.url;

    if (evidence.storageKey && storageService.isConfigured) {
      return storageService.generateViewUrl(evidence.storageKey);
    }

    container.logger.debug(
      `[EvidenceService.generateViewUrl] evidenceId=${evidenceId}, hasUrl=${!!evidence.url}, hasStorageKey=${!!evidence.storageKey}, storageConfigured=${storageService.isConfigured}`,
    );
    throw new Error("No viewable content for this evidence item");
  }

  /**
   * Generate a time-limited download URL for an evidence file.
   */
  async generateDownloadUrl(evidenceId: string): Promise<string> {
    const evidence = await container.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });
    if (!evidence) throw new Error("Evidence not found");

    if (!evidence.storageKey)
      throw new Error("No downloadable file for this evidence item");
    if (!storageService.isConfigured)
      throw new Error("Storage is not configured");

    const filename = evidence.originalFilename ?? `evidence_${evidenceId}`;
    return storageService.generateDownloadUrl(evidence.storageKey, filename);
  }

  // ─── Case Number ───

  /**
   * Get the next available case number for a guild (for pre-filling the modal).
   */
  async getNextCaseNumber(guildId: string): Promise<number> {
    const lastCase = await container.prisma.modCase.findFirst({
      where: { guildId },
      orderBy: { caseNumber: "desc" },
    });

    return (lastCase?.caseNumber ?? 0) + 1;
  }

  // ─── Dashboard URL Generation ───

  /**
   * Generate a dashboard URL for a case's evidence page.
   */
  generateCaseUrl(guildId: string, caseNumber: number): string {
    return `${CONFIG.DASHBOARD_URL}/mod/${guildId}/cases/${caseNumber}`;
  }

  /**
   * Generate a dashboard URL for adding evidence to a case.
   */
  generateEvidenceListUrl(guildId: string, caseNumber: number): string {
    return `${CONFIG.DASHBOARD_URL}/mod/${guildId}/cases/${caseNumber}/evidence`;
  }
}

export const evidenceService = new EvidenceService();
