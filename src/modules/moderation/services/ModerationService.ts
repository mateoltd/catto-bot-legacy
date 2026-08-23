import { container } from '@sapphire/framework';
import type { Guild, GuildMember, User } from 'discord.js';
import { ModAction } from '@prisma/client';
import {
  type GuildId,
  type UserId,
  type DurationSeconds,
  type CaseNumber,
  type ModCaseInput,
  type ModerateCheckResult,
  type ModActionResult,
  type ModStats,
  asCaseNumber,
} from '../domain/types.js';

/**
 * ModerationService - Core business logic for moderation actions
 * Commands should be thin wrappers that call these methods
 */
export class ModerationService {
  /**
   * Get the next case number for a guild
   */
  private async getNextCaseNumber(guildId: GuildId): Promise<CaseNumber> {
    const lastCase = await container.prisma.modCase.findFirst({
      where: { guildId },
      orderBy: { caseNumber: 'desc' },
    });

    return asCaseNumber((lastCase?.caseNumber ?? 0) + 1);
  }

  /**
   * Create a moderation case in the database
   */
  async createCase(data: ModCaseInput): Promise<{ caseNumber: CaseNumber; id: string }> {
    const caseNumber = await this.getNextCaseNumber(data.guildId);

    const modCase = await container.prisma.modCase.create({
      data: {
        caseNumber,
        guildId: data.guildId,
        action: data.action,
        targetId: data.targetId,
        targetTag: data.targetTag,
        moderatorId: data.moderatorId,
        moderatorTag: data.moderatorTag,
        reason: data.reason ?? 'No reason provided',
        duration: data.duration,
        expiresAt: data.expiresAt,
      },
    });

    return { caseNumber, id: modCase.id };
  }

  /**
   * Get a case by number
   */
  async getCase(guildId: GuildId, caseNumber: number) {
    return container.prisma.modCase.findUnique({
      where: {
        guildId_caseNumber: {
          guildId,
          caseNumber,
        },
      },
    });
  }

  /**
   * Get all cases for a user
   */
  async getUserCases(guildId: GuildId, userId: UserId) {
    return container.prisma.modCase.findMany({
      where: {
        guildId,
        targetId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if moderator can moderate target
   */
  canModerate(moderator: GuildMember, target: GuildMember): ModerateCheckResult {
    // Can't moderate yourself
    if (moderator.id === target.id) {
      return { canModerate: false, reason: 'You cannot moderate yourself' };
    }

    // Can't moderate the guild owner
    if (target.id === target.guild.ownerId) {
      return { canModerate: false, reason: 'You cannot moderate the server owner' };
    }

    // Can't moderate bots (unless admin)
    if (target.user.bot && !moderator.permissions.has('Administrator')) {
      return { canModerate: false, reason: 'You cannot moderate bots' };
    }

    // Check role hierarchy
    if (target.roles.highest.position >= moderator.roles.highest.position) {
      return { canModerate: false, reason: 'Target has equal or higher role than you' };
    }

    // Check bot's role hierarchy
    const botMember = target.guild.members.me;
    if (botMember && target.roles.highest.position >= botMember.roles.highest.position) {
      return { canModerate: false, reason: 'Target has equal or higher role than me' };
    }

    return { canModerate: true };
  }

  /**
   * Execute a ban action
   */
  async ban(
    guild: Guild,
    target: User,
    moderator: User,
    reason: string,
    deleteMessages: boolean
  ): Promise<ModActionResult> {
    return this.banById(guild, target.id as UserId, target.tag, moderator, reason, deleteMessages);
  }

  /**
   * Execute a ban action by user ID (for banning users not in the server)
   */
  async banById(
    guild: Guild,
    targetId: UserId,
    targetTag: string,
    moderator: User,
    reason: string,
    deleteMessages: boolean
  ): Promise<ModActionResult> {
    try {
      await guild.members.ban(targetId, {
        reason: `${reason} | Moderator: ${moderator.tag}`,
        deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0,
      });

      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.BAN,
        targetId: targetId,
        targetTag: targetTag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
      });

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to ban user:', error);
      return { success: false, error: 'Failed to ban the user', userNotified: false };
    }
  }

  /**
   * Execute a kick action
   */
  async kick(
    guild: Guild,
    targetMember: GuildMember,
    moderator: User,
    reason: string
  ): Promise<ModActionResult> {
    try {
      await targetMember.kick(`${reason} | Moderator: ${moderator.tag}`);

      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.KICK,
        targetId: targetMember.id as UserId,
        targetTag: targetMember.user.tag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
      });

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to kick user:', error);
      return { success: false, error: 'Failed to kick the user', userNotified: false };
    }
  }

  /**
   * Execute a timeout action
   */
  async timeout(
    guild: Guild,
    targetMember: GuildMember,
    moderator: User,
    reason: string,
    durationSeconds: DurationSeconds
  ): Promise<ModActionResult> {
    try {
      const durationMs = durationSeconds * 1000;
      await targetMember.timeout(durationMs, `${reason} | Moderator: ${moderator.tag}`);

      const expiresAt = new Date(Date.now() + durationMs);
      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.TIMEOUT,
        targetId: targetMember.id as UserId,
        targetTag: targetMember.user.tag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
        duration: durationSeconds,
        expiresAt,
      });

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to timeout user:', error);
      return { success: false, error: 'Failed to timeout the user', userNotified: false };
    }
  }

  /**
   * Execute a warn action (just creates a case, no Discord action)
   */
  async warn(
    guild: Guild,
    target: User,
    moderator: User,
    reason: string
  ): Promise<ModActionResult> {
    try {
      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.WARN,
        targetId: target.id as UserId,
        targetTag: target.tag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
      });

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to warn user:', error);
      return { success: false, error: 'Failed to create warning', userNotified: false };
    }
  }

  /**
   * Execute an unban action
   */
  async unban(
    guild: Guild,
    userId: UserId,
    userTag: string,
    moderator: User,
    reason: string
  ): Promise<ModActionResult> {
    try {
      await guild.members.unban(userId, `${reason} | Moderator: ${moderator.tag}`);

      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.UNBAN,
        targetId: userId,
        targetTag: userTag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
      });

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to unban user:', error);
      return { success: false, error: 'Failed to unban the user', userNotified: false };
    }
  }

  /**
   * Execute a softban action (ban then immediate unban to delete messages)
   */
  async softban(
    guild: Guild,
    target: User,
    moderator: User,
    reason: string,
    deleteMessagesDays: number = 7
  ): Promise<ModActionResult> {
    return this.softbanById(
      guild,
      target.id as UserId,
      target.tag,
      moderator,
      reason,
      deleteMessagesDays
    );
  }

  /**
   * Execute a softban action by user ID (for softbanning users not in the server)
   */
  async softbanById(
    guild: Guild,
    targetId: UserId,
    targetTag: string,
    moderator: User,
    reason: string,
    deleteMessagesDays: number = 7
  ): Promise<ModActionResult> {
    try {
      // Ban with message deletion
      await guild.members.ban(targetId, {
        reason: `[SOFTBAN] ${reason} | Moderator: ${moderator.tag}`,
        deleteMessageSeconds: deleteMessagesDays * 24 * 60 * 60,
      });

      // Immediately unban
      await guild.members.unban(
        targetId,
        `[SOFTBAN] Automatic unban | Moderator: ${moderator.tag}`
      );

      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.SOFTBAN,
        targetId: targetId,
        targetTag: targetTag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
      });

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to softban user:', error);
      return { success: false, error: 'Failed to softban the user', userNotified: false };
    }
  }

  /**
   * Execute a tempban action (ban with scheduled unban)
   */
  async tempban(
    guild: Guild,
    target: User,
    moderator: User,
    reason: string,
    durationSeconds: DurationSeconds,
    deleteMessages: boolean = false
  ): Promise<ModActionResult> {
    return this.tempbanById(
      guild,
      target.id as UserId,
      target.tag,
      moderator,
      reason,
      durationSeconds,
      deleteMessages
    );
  }

  /**
   * Execute a tempban action by user ID (for tempbanning users not in the server)
   */
  async tempbanById(
    guild: Guild,
    targetId: UserId,
    targetTag: string,
    moderator: User,
    reason: string,
    durationSeconds: DurationSeconds,
    deleteMessages: boolean = false
  ): Promise<ModActionResult> {
    try {
      // Import tempban scheduler dynamically to avoid circular dependencies
      const { tempbanScheduler } = await import('./TempbanScheduler.js');

      // Ban the user
      await guild.members.ban(targetId, {
        reason: `[TEMPBAN] ${reason} | Moderator: ${moderator.tag}`,
        deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0,
      });

      const expiresAt = new Date(Date.now() + durationSeconds * 1000);
      const { caseNumber } = await this.createCase({
        guildId: guild.id as GuildId,
        action: ModAction.TEMPBAN,
        targetId: targetId,
        targetTag: targetTag,
        moderatorId: moderator.id as UserId,
        moderatorTag: moderator.tag,
        reason,
        duration: durationSeconds,
        expiresAt,
      });

      // Schedule the unban
      await tempbanScheduler.scheduleUnban(
        guild.id as GuildId,
        targetId,
        caseNumber,
        reason,
        durationSeconds * 1000
      );

      return { success: true, caseNumber, userNotified: false };
    } catch (error) {
      container.logger.error('Failed to tempban user:', error);
      return { success: false, error: 'Failed to tempban the user', userNotified: false };
    }
  }

  /**
   * Get moderation statistics for a guild
   */
  async getStats(guildId: GuildId): Promise<ModStats> {
    const cases = await container.prisma.modCase.findMany({
      where: { guildId },
    });

    const muteActions = new Set<ModAction>([
      ModAction.MUTE_TEXT,
      ModAction.MUTE_VOICE,
      ModAction.MUTE_BOTH,
    ]);

    return {
      total: cases.length,
      bans: cases.filter((c) => c.action === ModAction.BAN).length,
      kicks: cases.filter((c) => c.action === ModAction.KICK).length,
      timeouts: cases.filter((c) => c.action === ModAction.TIMEOUT).length,
      warns: cases.filter((c) => c.action === ModAction.WARN).length,
      mutes: cases.filter((c) => muteActions.has(c.action)).length,
    };
  }

  /**
   * Get mod config for a guild
   */
  async getConfig(guildId: GuildId) {
    return container.prisma.modConfig.findUnique({
      where: { guildId },
    });
  }
}

// Export singleton instance
export const moderationService = new ModerationService();
