import { ModAction } from '@prisma/client';
import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { RateLimitGate } from '#lib/validation/RateLimitGate.js';

export class ModerationStatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/stats',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    // Verify guild exists in cache
    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    // Authenticate request
    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate) {
      return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
    }

    const auth = await gate.checkAuth('mod.cases.view');
    if (!auth.ok) {
      return response.status(403).json({ error: 'Forbidden', code: auth.code });
    }

    const rateLimit = await gate.checkRateLimit('cases.view', RateLimitGate.LIMITS['cases.view']!);
    if (!rateLimit.ok) {
      return response
        .status(429)
        .json({ error: 'Rate Limited', retryAfterMs: rateLimit.metadata?.retryAfterMs });
    }

    return this.handleGet(guildId, gate.userId, request, response);
  }

  private async handleGet(
    guildId: string,
    userId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      // Parse query parameters
      const startDate = request.query?.startDate as string | undefined;
      const endDate = request.query?.endDate as string | undefined;
      const moderatorId = request.query?.moderatorId as string | undefined;

      // Build base filter
      const baseFilter: {
        guildId: string;
        moderatorId?: string;
        createdAt?: {
          gte?: Date;
          lte?: Date;
        };
      } = { guildId };

      // Optional moderator filter (for user-specific stats)
      if (moderatorId) {
        baseFilter.moderatorId = moderatorId;
      }

      // Optional date range filter
      if (startDate || endDate) {
        baseFilter.createdAt = {};
        if (startDate) {
          const parsedStart = new Date(startDate);
          if (!isNaN(parsedStart.getTime())) {
            baseFilter.createdAt.gte = parsedStart;
          }
        }
        if (endDate) {
          const parsedEnd = new Date(endDate);
          if (!isNaN(parsedEnd.getTime())) {
            baseFilter.createdAt.lte = parsedEnd;
          }
        }
      }

      // Run all queries in parallel for performance
      const [totalCases, casesByAction, topModerators, recentCases, activePunishments, userStats] =
        await Promise.all([
          // Total cases (no limit on count)
          this.container.prisma.modCase.count({
            where: baseFilter,
          }),

          // Cases grouped by action (no limit on groupBy)
          this.container.prisma.modCase.groupBy({
            by: ['action'],
            where: baseFilter,
            _count: {
              action: true,
            },
          }),

          // Top moderators
          this.container.prisma.modCase.groupBy({
            by: ['moderatorId', 'moderatorTag'],
            where: { guildId }, // Always show top mods for guild, not filtered
            _count: {
              moderatorId: true,
            },
            orderBy: {
              _count: {
                moderatorId: 'desc',
              },
            },
            take: 10,
          }),

          // Recent cases
          this.container.prisma.modCase.findMany({
            where: baseFilter,
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),

          // Active temporary punishments
          this.container.prisma.modCase.count({
            where: {
              guildId,
              action: {
                in: [
                  ModAction.TIMEOUT,
                  ModAction.MUTE_TEXT,
                  ModAction.MUTE_VOICE,
                  ModAction.MUTE_BOTH,
                ],
              },
              expiresAt: {
                gt: new Date(),
              },
            },
          }),

          // Current user's stats in this guild (for dashboard user activity)
          this.container.prisma.modCase.groupBy({
            by: ['action'],
            where: {
              guildId,
              moderatorId: userId,
            },
            _count: {
              action: true,
            },
          }),
        ]);

      // Format action counts from groupBy results
      const formatActionCounts = (grouped: { action: ModAction; _count: { action: number } }[]) => {
        const counts = grouped.reduce(
          (acc, stat) => {
            acc[stat.action] = stat._count.action;
            return acc;
          },
          {} as Record<string, number>
        );

        const muteCount =
          (counts.MUTE_TEXT ?? 0) + (counts.MUTE_VOICE ?? 0) + (counts.MUTE_BOTH ?? 0);
        const unmuteCount =
          (counts.UNMUTE_TEXT ?? 0) + (counts.UNMUTE_VOICE ?? 0) + (counts.UNMUTE_BOTH ?? 0);

        return {
          bans: counts.BAN ?? 0,
          kicks: counts.KICK ?? 0,
          timeouts: counts.TIMEOUT ?? 0,
          warns: counts.WARN ?? 0,
          unbans: counts.UNBAN ?? 0,
          softbans: counts.SOFTBAN ?? 0,
          tempbans: counts.TEMPBAN ?? 0,
          mutes: muteCount,
          unmutes: unmuteCount,
        };
      };

      // Calculate user's total actions
      const userTotalActions = userStats.reduce((sum, s) => sum + s._count.action, 0);

      return response.json({
        guildId,
        totalCases,
        actionCounts: formatActionCounts(casesByAction),
        activePunishments,
        topModerators: topModerators.map((mod) => ({
          id: mod.moderatorId,
          tag: mod.moderatorTag,
          cases: mod._count.moderatorId,
        })),
        recentCases,
        // User-specific stats for the requesting user
        userStats: {
          moderatorId: userId,
          totalActions: userTotalActions,
          actionCounts: formatActionCounts(userStats),
        },
      });
    } catch (error) {
      this.container.logger.error('Error fetching moderation stats:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
