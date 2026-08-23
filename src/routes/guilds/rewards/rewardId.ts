import { Route } from '@sapphire/plugin-api';
import { RewardService } from '#root/modules/rewards/index.js';
import { parseRequestBody } from '#lib/route-utils.js';

export class RewardRoute extends Route {
  private rewardService: RewardService;

  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/rewards/[rewardId]',
      methods: ['GET', 'PATCH', 'DELETE'],
    });
    this.rewardService = new RewardService(this.container.prisma);
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, rewardId } = request.params;

    if (!guildId || !rewardId) {
      return response.status(400).json({
        error: 'Guild ID and Reward ID are required',
      });
    }

    // Skip reserved route segments to avoid conflicts with specific routes
    const reservedPaths = ['users', 'stats', 'templates'];
    if (reservedPaths.includes(rewardId.toLowerCase())) {
      return response.status(404).json({
        error: 'Not found',
      });
    }

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    if (request.method === 'GET') {
      return this.handleGet(guildId, rewardId, response);
    } else if (request.method === 'PATCH') {
      const body = await parseRequestBody(request);
      return this.handlePatch(guildId, rewardId, body, response);
    } else if (request.method === 'DELETE') {
      return this.handleDelete(guildId, rewardId, response);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  }

  /**
   * GET - Get a specific reward
   */
  private async handleGet(guildId: string, rewardId: string, response: Route.Response) {
    try {
      const rewards = await this.rewardService.getGuildRewards(guildId);
      const reward = rewards.find((r) => r.id === rewardId);

      if (!reward) {
        return response.status(404).json({
          error: 'Reward not found',
        });
      }

      return response.json({
        success: true,
        reward,
      });
    } catch (error) {
      this.container.logger.error('Error fetching reward:', error);
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * PATCH - Update a reward
   */
  private async handlePatch(
    guildId: string,
    rewardId: string,
    body: unknown,
    response: Route.Response
  ) {
    try {
      if (!body || typeof body !== 'object') {
        return response.status(400).json({
          error: 'Invalid request body',
        });
      }

      const bodyData = body as {
        level?: number;
        xpType?: string;
        rewardType?: string;
        rewardData?: unknown;
        name?: string;
        description?: string;
        icon?: string;
        oneTime?: boolean;
        stackable?: boolean;
        requiresPrevious?: boolean;
        priority?: number;
        enabled?: boolean;
      };

      // Verify reward exists and belongs to this guild
      const rewards = await this.rewardService.getGuildRewards(guildId);
      const existingReward = rewards.find((r) => r.id === rewardId);

      if (!existingReward) {
        return response.status(404).json({
          error: 'Reward not found',
        });
      }

      // Build update object with only provided fields
      const updates: Record<string, unknown> = {};

      if (bodyData.level !== undefined) {
        if (typeof bodyData.level !== 'number' || bodyData.level < 1 || bodyData.level > 1000) {
          return response.status(400).json({
            error: 'Level must be a number between 1 and 1000',
          });
        }
        updates.level = bodyData.level;
      }

      if (bodyData.xpType !== undefined) {
        if (!['TEXT', 'VOICE', 'BOTH'].includes(bodyData.xpType)) {
          return response.status(400).json({
            error: 'xpType must be TEXT, VOICE, or BOTH',
          });
        }
        updates.xpType = bodyData.xpType;
      }

      if (bodyData.rewardType !== undefined) updates.rewardType = bodyData.rewardType;
      if (bodyData.rewardData !== undefined) updates.rewardData = bodyData.rewardData;
      if (bodyData.name !== undefined) updates.name = bodyData.name;
      if (bodyData.description !== undefined) updates.description = bodyData.description;
      if (bodyData.icon !== undefined) updates.icon = bodyData.icon;
      if (bodyData.oneTime !== undefined) updates.oneTime = bodyData.oneTime;
      if (bodyData.stackable !== undefined) updates.stackable = bodyData.stackable;
      if (bodyData.requiresPrevious !== undefined)
        updates.requiresPrevious = bodyData.requiresPrevious;
      if (bodyData.priority !== undefined) updates.priority = bodyData.priority;
      if (bodyData.enabled !== undefined) updates.enabled = bodyData.enabled;

      const updatedReward = await this.rewardService.updateReward(rewardId, updates);

      return response.json({
        success: true,
        reward: updatedReward,
      });
    } catch (error) {
      this.container.logger.error('Error updating reward:', error);
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * DELETE - Delete a reward
   */
  private async handleDelete(guildId: string, rewardId: string, response: Route.Response) {
    try {
      // Verify reward exists and belongs to this guild
      const rewards = await this.rewardService.getGuildRewards(guildId);
      const existingReward = rewards.find((r) => r.id === rewardId);

      if (!existingReward) {
        return response.status(404).json({
          error: 'Reward not found',
        });
      }

      await this.rewardService.deleteReward(rewardId);

      return response.json({
        success: true,
        message: 'Reward deleted successfully',
      });
    } catch (error) {
      this.container.logger.error('Error deleting reward:', error);
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
