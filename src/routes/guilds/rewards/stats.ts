/**
 * Rewards Statistics Route
 * GET /api/guilds/:guildId/rewards/stats
 */

import { Route } from '@sapphire/plugin-api';
import { RewardService } from '#root/modules/rewards/index.js';

export class RewardsStatsRoute extends Route {
  private rewardService: RewardService;

  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/rewards/stats',
      methods: ['GET'],
    });
    this.rewardService = new RewardService(this.container.prisma);
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    try {
      const rewards = await this.rewardService.getGuildRewards(guildId);

      // Get claim statistics
      const claimStats = await this.container.prisma.userRewardClaim.groupBy({
        by: ['rewardId'],
        where: {
          guildId,
          status: 'ACTIVE',
        },
        _count: {
          rewardId: true,
        },
      });

      const claimsByReward = new Map(
        claimStats.map((stat) => [stat.rewardId, stat._count.rewardId])
      );

      // Calculate statistics
      const stats = {
        totalRewards: rewards.length,
        enabledRewards: rewards.filter((r) => r.enabled).length,
        disabledRewards: rewards.filter((r) => !r.enabled).length,
        byXpType: {
          TEXT: rewards.filter((r) => r.xpType === 'TEXT').length,
          VOICE: rewards.filter((r) => r.xpType === 'VOICE').length,
          BOTH: rewards.filter((r) => r.xpType === 'BOTH').length,
        },
        byRewardType: {} as Record<string, number>,
        totalClaims: Array.from(claimsByReward.values()).reduce((sum, count) => sum + count, 0),
        mostClaimedRewards: rewards
          .map((r) => ({
            id: r.id,
            name: r.name,
            level: r.level,
            claims: claimsByReward.get(r.id ?? '') || 0,
          }))
          .sort((a, b) => b.claims - a.claims)
          .slice(0, 10),
        levelDistribution: rewards.reduce(
          (acc, r) => {
            const levelRange = Math.floor(r.level / 10) * 10;
            const key = `${levelRange}-${levelRange + 9}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      };

      // Count by reward type
      for (const reward of rewards) {
        stats.byRewardType[reward.rewardType] = (stats.byRewardType[reward.rewardType] || 0) + 1;
      }

      return response.json({
        success: true,
        stats,
      });
    } catch (error) {
      this.container.logger.error('Error fetching reward stats:', error);
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
