/**
 * BulkActionService - Handles batch moderation actions
 *
 * Provides rate-limited bulk operations for ban, kick, mute, and warn actions.
 * All actions are logged individually and failures are tracked per-user.
 */

import { container } from '@sapphire/framework';
import type { Guild, GuildMember, User } from 'discord.js';
import {
  type GuildId,
  type UserId,
  type DurationSeconds,
  type BulkResult,
  asUserId,
} from '../domain/types.js';
import { moderationService } from './ModerationService.js';
import { muteService } from './MuteService.js';
import { ensureNonNull } from '#root/lib/utils.js';

/**
 * Supported bulk action types
 */
export type BulkActionType =
  | 'ban'
  | 'kick'
  | 'mute_text'
  | 'mute_voice'
  | 'mute_both'
  | 'warn'
  | 'timeout';

/**
 * Input for bulk actions
 */
export interface BulkActionInput {
  guildId: GuildId;
  userIds: UserId[];
  moderatorId: UserId;
  moderatorTag: string;
  reason: string;
  duration?: DurationSeconds;
  deleteMessages?: boolean;
}

/**
 * Progress callback for bulk operations
 */
export type BulkProgressCallback = (completed: number, total: number, current: UserId) => void;

/**
 * Rate limit configuration
 */
const RATE_LIMIT = {
  delayBetweenActions: 500, // ms between each action
  maxConcurrent: 1, // sequential to avoid rate limits
  maxUsersPerBulk: 25, // safety limit
};

/**
 * Sleep utility
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * BulkActionService - Handles batch moderation operations
 */
class BulkActionServiceImpl {
  /**
   * Execute bulk ban
   */
  async bulkBan(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    return this.executeBulkAction(
      guild,
      input,
      async (user, moderator) => {
        const result = await moderationService.ban(
          guild,
          user,
          moderator,
          input.reason,
          input.deleteMessages ?? true
        );
        if (!result.success) {
          throw new Error(result.error || 'Ban failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute bulk kick
   */
  async bulkKick(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    return this.executeBulkAction(
      guild,
      input,
      async (_user, moderator, member) => {
        if (!member) {
          throw new Error('User is not in the server');
        }
        const result = await moderationService.kick(guild, member, moderator, input.reason);
        if (!result.success) {
          throw new Error(result.error || 'Kick failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute bulk warn
   */
  async bulkWarn(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    return this.executeBulkAction(
      guild,
      input,
      async (user, moderator) => {
        const result = await moderationService.warn(guild, user, moderator, input.reason);
        if (!result.success) {
          throw new Error(result.error || 'Warn failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute bulk timeout
   */
  async bulkTimeout(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    if (!input.duration) {
      return {
        total: input.userIds.length,
        succeeded: 0,
        failed: input.userIds.length,
        errors: input.userIds.map((userId) => ({
          userId,
          error: 'Duration is required for timeout',
        })),
      };
    }

    return this.executeBulkAction(
      guild,
      input,
      async (_user, moderator, member) => {
        if (!member) {
          throw new Error('User is not in the server');
        }
        const result = await moderationService.timeout(
          guild,
          member,
          moderator,
          input.reason,
          ensureNonNull(input.duration, 'bulkTimeout > executeBulkAction(173): input.duration')
        );
        if (!result.success) {
          throw new Error(result.error || 'Timeout failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute bulk text mute
   */
  async bulkMuteText(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    return this.executeBulkAction(
      guild,
      input,
      async (user, _moderator, member) => {
        if (!member) {
          throw new Error('User is not in the server');
        }
        const result = await muteService.muteText(
          guild,
          member,
          input.moderatorId,
          input.moderatorTag,
          {
            guildId: input.guildId,
            userId: asUserId(user.id),
            createdById: input.moderatorId,
            reason: input.reason,
            duration: input.duration,
          }
        );
        if (!result.success) {
          throw new Error(result.error || 'Mute failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute bulk voice mute
   */
  async bulkMuteVoice(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    return this.executeBulkAction(
      guild,
      input,
      async (user, _moderator, member) => {
        if (!member) {
          throw new Error('User is not in the server');
        }
        const result = await muteService.muteVoice(
          guild,
          member,
          input.moderatorId,
          input.moderatorTag,
          {
            guildId: input.guildId,
            userId: asUserId(user.id),
            createdById: input.moderatorId,
            reason: input.reason,
            duration: input.duration,
          }
        );
        if (!result.success) {
          throw new Error(result.error || 'Voice mute failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute bulk combined mute (text + voice)
   */
  async bulkMuteBoth(
    guild: Guild,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    return this.executeBulkAction(
      guild,
      input,
      async (user, _moderator, member) => {
        if (!member) {
          throw new Error('User is not in the server');
        }
        const result = await muteService.muteBoth(
          guild,
          member,
          input.moderatorId,
          input.moderatorTag,
          {
            guildId: input.guildId,
            userId: asUserId(user.id),
            createdById: input.moderatorId,
            reason: input.reason,
            duration: input.duration,
          }
        );
        if (!result.success) {
          throw new Error(result.error || 'Combined mute failed');
        }
      },
      onProgress
    );
  }

  /**
   * Execute any bulk action type
   */
  async execute(
    guild: Guild,
    actionType: BulkActionType,
    input: BulkActionInput,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    switch (actionType) {
      case 'ban':
        return this.bulkBan(guild, input, onProgress);
      case 'kick':
        return this.bulkKick(guild, input, onProgress);
      case 'warn':
        return this.bulkWarn(guild, input, onProgress);
      case 'timeout':
        return this.bulkTimeout(guild, input, onProgress);
      case 'mute_text':
        return this.bulkMuteText(guild, input, onProgress);
      case 'mute_voice':
        return this.bulkMuteVoice(guild, input, onProgress);
      case 'mute_both':
        return this.bulkMuteBoth(guild, input, onProgress);
      default:
        return {
          total: input.userIds.length,
          succeeded: 0,
          failed: input.userIds.length,
          errors: input.userIds.map((userId) => ({
            userId,
            error: `Unknown action type: ${actionType}`,
          })),
        };
    }
  }

  /**
   * Validate bulk action input
   */
  validateInput(input: BulkActionInput): { valid: boolean; error?: string } {
    if (input.userIds.length === 0) {
      return { valid: false, error: 'No users specified' };
    }

    if (input.userIds.length > RATE_LIMIT.maxUsersPerBulk) {
      return {
        valid: false,
        error: `Too many users (max ${RATE_LIMIT.maxUsersPerBulk})`,
      };
    }

    if (!input.reason || input.reason.trim().length === 0) {
      return { valid: false, error: 'Reason is required' };
    }

    // Check for duplicate user IDs
    const uniqueIds = new Set(input.userIds);
    if (uniqueIds.size !== input.userIds.length) {
      return { valid: false, error: 'Duplicate user IDs in list' };
    }

    // Check moderator is not in target list
    if (input.userIds.includes(input.moderatorId)) {
      return { valid: false, error: 'Cannot include yourself in bulk action' };
    }

    return { valid: true };
  }

  /**
   * Get estimated time for bulk action
   */
  getEstimatedTime(userCount: number): number {
    return userCount * RATE_LIMIT.delayBetweenActions;
  }

  /**
   * Internal: Execute bulk action with rate limiting
   */
  private async executeBulkAction(
    guild: Guild,
    input: BulkActionInput,
    action: (user: User, moderator: User, member: GuildMember | null) => Promise<void>,
    onProgress?: BulkProgressCallback
  ): Promise<BulkResult> {
    const validation = this.validateInput(input);
    if (!validation.valid) {
      return {
        total: input.userIds.length,
        succeeded: 0,
        failed: input.userIds.length,
        errors: input.userIds.map((userId) => ({
          userId,
          error: validation.error || 'Validation failed',
        })),
      };
    }

    const result: BulkResult = {
      total: input.userIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Fetch moderator user
    const moderator = await container.client.users.fetch(input.moderatorId).catch(() => null);
    if (!moderator) {
      return {
        total: input.userIds.length,
        succeeded: 0,
        failed: input.userIds.length,
        errors: input.userIds.map((userId) => ({
          userId,
          error: 'Failed to fetch moderator',
        })),
      };
    }

    // Process each user sequentially with rate limiting
    for (const userId of input.userIds) {
      const currentIndex = input.userIds.indexOf(userId);

      // Report progress
      if (onProgress) {
        onProgress(currentIndex, input.userIds.length, userId);
      }

      try {
        // Fetch user
        const user = await container.client.users.fetch(userId).catch(() => null);
        if (!user) {
          result.failed++;
          result.errors.push({ userId, error: 'User not found' });
          continue;
        }

        // Fetch member (may be null for bans/warns)
        const member = await guild.members.fetch(userId).catch(() => null);

        // Check if can moderate (when member exists)
        if (member) {
          const botMember = guild.members.me;
          const modMember = await guild.members.fetch(input.moderatorId).catch(() => null);

          if (modMember && botMember) {
            const check = moderationService.canModerate(modMember, member);
            if (!check.canModerate) {
              result.failed++;
              result.errors.push({ userId, error: check.reason || 'Cannot moderate this user' });
              continue;
            }
          }
        }

        // Execute the action
        await action(user, moderator, member);
        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        container.logger.error(`[BulkActionService] Error processing ${userId}:`, error);
      }

      // Rate limit delay (except for last item)
      if (currentIndex < input.userIds.length - 1) {
        await sleep(RATE_LIMIT.delayBetweenActions);
      }
    }

    // Final progress report
    if (onProgress && input.userIds.length > 0) {
      const lastUserId = ensureNonNull(
        input.userIds[input.userIds.length - 1],
        'bulkActionService > executeBulkAction(467): input.userIds[input.userIds.length - 1]'
      );
      onProgress(input.userIds.length, input.userIds.length, lastUserId);
    }

    return result;
  }
}

/**
 * Singleton instance
 */
export const bulkActionService = new BulkActionServiceImpl();
