/**
 * Guild Audit Log Monitor for Discovery Issues
 *
 * Monitors guild audit logs for potential Discovery-related flags
 * and Community Standard violations that may indicate inappropriate channel names.
 *
 * Note: Discord doesn't provide direct Discovery revocation events,
 * so this implementation monitors audit logs for channel updates and flags.
 */

import { Listener } from "@sapphire/framework";
import { Events, AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { container } from "@sapphire/framework";
import {
  KeywordQueueService,
  KeywordSource,
} from "../../modules/temp-voice/services/moderation/keyword-queue.service.js";
import { extractKeywords } from "../../modules/temp-voice/utils/keyword-extraction.util.js";
import { TempChannelService } from "../../modules/temp-voice/services/temp-channel.service.js";

/**
 * Monitors guild updates that might indicate Discovery issues
 */
export class GuildAuditLogListener extends Listener {
  private keywordQueueService!: KeywordQueueService;
  private channelService!: TempChannelService;
  private processedEntries: Set<string> = new Set(); // Track processed audit log IDs
  private readonly CACHE_SIZE = 1000;

  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: Events.GuildUpdate,
    });
  }

  public async run(oldGuild: Guild, newGuild: Guild): Promise<void> {
    // Initialize services (lazy initialization)
    if (!this.keywordQueueService) {
      this.keywordQueueService = new KeywordQueueService(container.prisma);
      this.channelService = new TempChannelService(container.prisma);
    }

    try {
      // Check if guild features changed (potential Discovery removal)
      const lostDiscovery =
        oldGuild.features.includes("DISCOVERABLE") &&
        !newGuild.features.includes("DISCOVERABLE");

      const lostCommunity =
        oldGuild.features.includes("COMMUNITY") &&
        !newGuild.features.includes("COMMUNITY");

      if (lostDiscovery || lostCommunity) {
        container.logger.info(
          `[Audit Monitor] Guild ${newGuild.id} lost ${lostDiscovery ? "Discovery" : "Community"} status`,
        );
        await this.scanRecentChannelUpdates(newGuild);
      }
    } catch (error) {
      container.logger.error(
        `[Audit Monitor] Error processing guild update for ${newGuild.id}:`,
        error,
      );
    }
  }

  /**
   * Scan recent audit logs for suspicious channel updates
   */
  private async scanRecentChannelUpdates(guild: Guild): Promise<void> {
    try {
      // Fetch recent audit logs for channel updates
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 50,
      });

      for (const entry of auditLogs.entries.values()) {
        // Skip if already processed
        if (this.processedEntries.has(entry.id)) {
          continue;
        }

        // Only process entries from last 7 days
        const entryAge = Date.now() - entry.createdTimestamp;
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        if (entryAge > SEVEN_DAYS_MS) {
          continue;
        }

        await this.processAuditLogEntry(guild, entry);

        // Mark as processed
        this.processedEntries.add(entry.id);

        // Cleanup cache if too large
        if (this.processedEntries.size > this.CACHE_SIZE) {
          const oldestEntries = Array.from(this.processedEntries).slice(0, 100);
          oldestEntries.forEach((id) => this.processedEntries.delete(id));
        }
      }
    } catch (error) {
      container.logger.error(
        `[Audit Monitor] Error scanning audit logs for ${guild.id}:`,
        error,
      );
    }
  }

  /**
   * Process a single audit log entry
   */
  private async processAuditLogEntry(
    guild: Guild,
    entry: GuildAuditLogsEntry,
  ): Promise<void> {
    // Check if this is a temp voice channel
    const channelId = entry.targetId;
    if (!channelId) return;

    const tempChannel = await this.channelService.getByChannelId(channelId);
    if (!tempChannel) return;

    // Look for name changes in audit log
    const changes = entry.changes;
    if (!changes) return;

    const nameChange = changes.find((change) => change.key === "name");
    if (!nameChange) return;

    const oldName = nameChange.old as string | undefined;
    const newName = nameChange.new as string | undefined;

    // If name was changed, the old name might have been problematic
    if (oldName && oldName !== newName) {
      container.logger.info(
        `[Audit Monitor] Found channel name change in audit log: "${oldName}" -> "${newName}"`,
      );

      // Extract keywords from the old name (which was changed)
      const keywords = extractKeywords(oldName, {
        minLength: 3,
        maxKeywords: 5,
        includeStopwords: false,
      });

      // Add keywords to queue for review
      for (const keyword of keywords) {
        try {
          await this.keywordQueueService.addKeyword({
            guildId: guild.id,
            keyword,
            source: KeywordSource.AUTO_DETECTED,
            contextSnippet: `Channel renamed from "${oldName}" to "${newName}"`,
            channelId,
            userId: entry.executorId ?? undefined,
          });

          container.logger.info(
            `[Audit Monitor] Added keyword to queue: "${keyword}" (from channel name change)`,
          );
        } catch (error) {
          container.logger.error(
            `[Audit Monitor] Failed to add keyword "${keyword}":`,
            error,
          );
        }
      }
    }
  }

  /**
   * Manually report a channel for review (can be called by admins)
   */
  public async reportChannel(
    guildId: string,
    channelId: string,
    channelName: string,
    reportedBy: string,
    reason?: string,
  ): Promise<void> {
    if (!this.keywordQueueService) {
      this.keywordQueueService = new KeywordQueueService(container.prisma);
    }

    try {
      // Extract keywords from the reported channel name
      const keywords = extractKeywords(channelName, {
        minLength: 3,
        maxKeywords: 10,
        includeStopwords: false,
      });

      container.logger.info(
        `[Audit Monitor] Manual report for channel ${channelId}: "${channelName}" (${keywords.length} keywords)`,
      );

      // Add all extracted keywords to the queue
      for (const keyword of keywords) {
        await this.keywordQueueService.addKeyword({
          guildId,
          keyword,
          source: KeywordSource.MANUAL_REPORT,
          contextSnippet: reason
            ? `${channelName} (Reason: ${reason})`
            : channelName,
          channelId,
          userId: reportedBy,
        });
      }
    } catch (error) {
      container.logger.error(
        `[Audit Monitor] Error reporting channel ${channelId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Scan all active temp voice channels for potential issues
   * (Can be run periodically or manually triggered)
   */
  public async scanAllTempChannels(guildId: string): Promise<number> {
    if (!this.keywordQueueService) {
      this.keywordQueueService = new KeywordQueueService(container.prisma);
    }
    if (!this.channelService) {
      this.channelService = new TempChannelService(container.prisma);
    }

    try {
      const channels = await this.channelService.getByGuildId(guildId);
      let flaggedCount = 0;

      for (const channel of channels) {
        if (!channel.channelId) continue;

        const discordChannel = await container.client.channels.fetch(
          channel.channelId,
        );
        if (!discordChannel || !discordChannel.isVoiceBased()) continue;

        const name = discordChannel.name;

        // Simple heuristic check for suspicious names
        const hasSuspiciousPatterns =
          /\d{3,}/.test(name) || // Many numbers
          /(.)\1{3,}/.test(name) || // Repeated characters
          /[\u0080-\uFFFF]{3,}/.test(name); // Many non-ASCII chars

        if (hasSuspiciousPatterns) {
          const keywords = extractKeywords(name, {
            minLength: 3,
            maxKeywords: 5,
          });

          for (const keyword of keywords) {
            await this.keywordQueueService.addKeyword({
              guildId,
              keyword,
              source: KeywordSource.AUTO_DETECTED,
              contextSnippet: `Auto-scan: "${name}"`,
              channelId: channel.channelId,
            });
          }

          flaggedCount++;
        }
      }

      container.logger.info(
        `[Audit Monitor] Scanned ${channels.length} temp channels, flagged ${flaggedCount}`,
      );
      return flaggedCount;
    } catch (error) {
      container.logger.error(
        `[Audit Monitor] Error scanning temp channels for ${guildId}:`,
        error,
      );
      throw error;
    }
  }
}
