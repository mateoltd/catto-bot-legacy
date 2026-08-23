/**
 * Service for recovering temp voice channels after bot restart.
 * Uses BullMQ (via tempVoiceQueue) as the single deletion authority.
 */

import { PrismaClient } from '@prisma/client';
import type { Client } from 'discord.js';
import { tempVoiceQueue } from './temp-voice-queue.service.js';
import { TempVoiceConfigService } from './config.service.js';

export class RecoveryService {
  private lastReconciliationStats = {
    totalRecovered: 0,
    deletedFromDb: 0,
    scheduledForDeletion: 0,
    lastRunAt: null as Date | null,
  };

  private configService: TempVoiceConfigService;

  constructor(
    private prisma: PrismaClient,
    private client: Client
  ) {
    this.configService = new TempVoiceConfigService(prisma, client);
  }

  /**
   * Reconcile database state with Discord after restart
   */
  async reconcileChannels(): Promise<void> {
    this.client.logger.info('[TempVoice] Starting channel reconciliation...');

    const dbChannels = await this.prisma.tempVoiceChannel.findMany();
    let recovered = 0;
    let deletedFromDb = 0;
    let scheduledForDeletion = 0;

    for (const record of dbChannels) {
      try {
        // Fetch guild
        const guild = this.client.guilds.cache.get(record.guildId);
        if (!guild) {
          // Guild not available - delete record
          await this.prisma.tempVoiceChannel.delete({
            where: { id: record.id },
          });
          deletedFromDb++;
          continue;
        }

        // Fetch channel
        const channel = await guild.channels.fetch(record.channelId).catch(() => null);

        if (!channel || !channel.isVoiceBased()) {
          // Channel doesn't exist - delete from database
          await this.prisma.tempVoiceChannel.delete({
            where: { id: record.id },
          });
          deletedFromDb++;
          continue;
        }

        // Channel exists - check if empty
        if (channel.members.size === 0) {
          // Empty channel — queue deletion via BullMQ
          const config = await this.configService.getOrNull(record.guildId);
          const delayMs = config ? config.deleteDelaySeconds * 1000 : 5000;
          await tempVoiceQueue.queueDelete(
            record.guildId,
            record.channelId,
            'Empty after restart',
            delayMs
          );
          scheduledForDeletion++;
        } else {
          // Channel has members - resume tracking
          await this.prisma.tempVoiceChannel.update({
            where: { id: record.id },
            data: {
              lastActiveAt: new Date(),
              deletionScheduledAt: null,
            },
          });
          recovered++;
        }
      } catch (error) {
        this.client.logger.error(
          `[TempVoice] Error reconciling channel ${record.channelId}:`,
          error
        );
      }
    }

    this.client.logger.info(
      `[TempVoice] Reconciliation complete: ${recovered} recovered, ${deletedFromDb} deleted, ${scheduledForDeletion} scheduled for deletion`
    );

    // Store stats for getRecoveryStats()
    this.lastReconciliationStats = {
      totalRecovered: recovered,
      deletedFromDb,
      scheduledForDeletion,
      lastRunAt: new Date(),
    };
  }

  /**
   * Get statistics about the last reconciliation process
   * Returns stats from the most recent reconcileChannels() run
   */
  async getRecoveryStats(): Promise<{
    totalRecovered: number;
    deletedFromDb: number;
    scheduledForDeletion: number;
    lastRunAt: Date | null;
  }> {
    return {
      totalRecovered: this.lastReconciliationStats.totalRecovered,
      deletedFromDb: this.lastReconciliationStats.deletedFromDb,
      scheduledForDeletion: this.lastReconciliationStats.scheduledForDeletion,
      lastRunAt: this.lastReconciliationStats.lastRunAt,
    };
  }
}
