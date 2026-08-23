import { Route } from '@sapphire/plugin-api';
import { ModAction } from '@prisma/client';

import { parseModAction } from '#lib/validation/modAction.js';
import { userProfileService } from '#modules/moderation/services/UserProfileService.js';

export class ModerationUserCasesRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/users/[userId]',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, userId } = request.params;
    const queryAction = request.query?.action as string | undefined;
    this.container.logger.info(
      `[UserRoute] run() guildId=${guildId} userId=${userId} action=${queryAction} full=${request.query?.full}`
    );

    if (!guildId || !userId) {
      return response.status(400).json({
        error: 'Guild ID and user ID are required',
      });
    }

    // Verify guild exists in cache
    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    return this.handleGet(guildId, userId, request, response);
  }

  private async handleGet(
    guildId: string,
    userId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      // Server status action
      const queryAction = request.query?.action as string | undefined;
      if (queryAction === 'server-status') {
        return this.handleServerStatus(guildId, userId, response);
      }

      // NH-6: Full profile mode
      const fullProfile = request.query?.full === 'true';
      if (fullProfile) {
        // Fetch DB profile and Discord avatar in parallel
        const [profile, avatarInfo] = await Promise.all([
          userProfileService.getUserProfile(guildId, userId),
          this.fetchAvatarInfo(guildId, userId),
        ]);
        return response.json({ ...profile, ...avatarInfo });
      }

      // Parse query parameters for pagination
      const page = parseInt((request.query?.page as string) ?? '1') || 1;
      const limit = Math.min(parseInt((request.query?.limit as string) ?? '50') || 50, 100);
      const actionFilter = queryAction;

      const skip = (page - 1) * limit;

      // Validate and convert action string to enum
      const modAction = actionFilter ? parseModAction(actionFilter.toUpperCase()) : undefined;

      // Build where clause
      const where: {
        guildId: string;
        targetId: string;
        action?: ModAction;
      } = {
        guildId,
        targetId: userId,
      };

      if (modAction) where.action = modAction;

      // Get total count
      const total = await this.container.prisma.modCase.count({ where });

      // Get cases
      const cases = await this.container.prisma.modCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      // Get statistics
      const stats = await this.container.prisma.modCase.groupBy({
        by: ['action'],
        where: {
          guildId,
          targetId: userId,
        },
        _count: {
          action: true,
        },
      });

      const actionCounts = stats.reduce(
        (acc, stat) => {
          acc[stat.action] = stat._count.action;
          return acc;
        },
        {} as Record<string, number>
      );

      const muteCount =
        (actionCounts.MUTE_TEXT ?? 0) +
        (actionCounts.MUTE_VOICE ?? 0) +
        (actionCounts.MUTE_BOTH ?? 0);
      const unmuteCount =
        (actionCounts.UNMUTE_TEXT ?? 0) +
        (actionCounts.UNMUTE_VOICE ?? 0) +
        (actionCounts.UNMUTE_BOTH ?? 0);

      return response.json({
        userId,
        guildId,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        statistics: {
          total,
          bans: actionCounts.BAN ?? 0,
          kicks: actionCounts.KICK ?? 0,
          timeouts: actionCounts.TIMEOUT ?? 0,
          warns: actionCounts.WARN ?? 0,
          unbans: actionCounts.UNBAN ?? 0,
          mutes: muteCount,
          unmutes: unmuteCount,
        },
        cases,
      });
    } catch (error) {
      this.container.logger.error('Error fetching user moderation cases:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  /**
   * Fetch avatar URL and username from Discord cache/API.
   * Returns quickly from cache when possible, falls back to API fetch.
   */
  private async fetchAvatarInfo(
    guildId: string,
    userId: string
  ): Promise<{ avatarUrl: string | null; username: string | null }> {
    try {
      // Check member cache first (guild-specific avatar)
      const guild = this.container.client.guilds.cache.get(guildId);
      const cachedMember = guild?.members.cache.get(userId);
      if (cachedMember) {
        return {
          avatarUrl: cachedMember.displayAvatarURL({ size: 128 }),
          username: cachedMember.user.username,
        };
      }

      // Check user cache
      const cachedUser = this.container.client.users.cache.get(userId);
      if (cachedUser) {
        return {
          avatarUrl: cachedUser.displayAvatarURL({ size: 128 }),
          username: cachedUser.username,
        };
      }

      // Fetch from Discord API
      const user = await this.container.client.users.fetch(userId);
      return {
        avatarUrl: user.displayAvatarURL({ size: 128 }),
        username: user.username,
      };
    } catch (err) {
      this.container.logger.warn(`[UserRoute] fetchAvatarInfo failed for ${userId}:`, err);
      return { avatarUrl: null, username: null };
    }
  }

  private async handleServerStatus(guildId: string, userId: string, response: Route.Response) {
    try {
      this.container.logger.info(
        `[ServerStatus] Handling server-status for user=${userId} guild=${guildId}`
      );

      const discordGuild = this.container.client.guilds.cache.get(guildId);
      if (!discordGuild) {
        this.container.logger.warn(`[ServerStatus] Guild ${guildId} not found in cache`);
        return response.status(404).json({ error: 'Guild not found' });
      }

      // Fetch user info for avatar
      let avatarUrl: string | null = null;
      let username: string | null = null;
      try {
        const user = await this.container.client.users.fetch(userId);
        avatarUrl = user.displayAvatarURL({ size: 128 }) || null;
        username = user.username;
      } catch (err) {
        this.container.logger.warn(`[ServerStatus] Failed to fetch user ${userId}:`, err);
      }

      // Check membership
      try {
        const member = await discordGuild.members.fetch({ user: userId, force: true });
        if (member) {
          const memberAvatar = member.displayAvatarURL({ size: 128 }) || null;
          return response.json({
            status: 'in_server' as const,
            isInServer: true,
            memberSince: member.joinedAt?.toISOString() ?? null,
            roles: member.roles.cache
              .filter((r) => r.id !== guildId)
              .sort((a, b) => b.position - a.position)
              .map((r) => r.name)
              .slice(0, 10),
            avatarUrl: memberAvatar ?? avatarUrl,
            username: member.user.username ?? username,
          });
        }
      } catch {
        // Member not in server or can't fetch
      }

      return response.json({
        status: 'left' as const,
        isInServer: false,
        memberSince: null,
        roles: [],
        avatarUrl,
        username,
      });
    } catch (error) {
      this.container.logger.error('Error fetching user server status:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
