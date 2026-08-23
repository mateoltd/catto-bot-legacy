import {
  configService,
  getAllGuildUsers,
  levelService,
  updateUserLevel,
} from '#root/modules/xp/xp-text/index.js';
import { Route } from '@sapphire/plugin-api';

export class XPRecalculateRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/xp/recalc',
      methods: ['POST'],
    });
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
      // Get guild configuration for level calculation
      const config = await configService.getConfig(guildId);

      // Process users in batches
      const batchSize = 500;
      let offset = 0;
      let processedCount = 0;
      let updatedCount = 0;

      this.container.logger.info(`Starting XP recalculation for guild ${guildId}`);

      while (true) {
        const users = await getAllGuildUsers(guildId, batchSize, offset);

        if (users.length === 0) {
          break;
        }

        for (const user of users) {
          // Calculate correct level based on current curve
          const newLevelCalc = levelService.calculateLevelWithConfig(config, user.xp);

          // Update if level changed
          if (newLevelCalc.level !== user.level) {
            await updateUserLevel(guildId, user.userId, newLevelCalc.level);
            updatedCount++;
          }

          processedCount++;
        }

        // Break if we got less than batchSize (last batch)
        if (users.length < batchSize) {
          break;
        }

        offset += batchSize;
      }

      this.container.logger.info(
        `XP recalculation complete for guild ${guildId}: ${processedCount} users processed, ${updatedCount} levels updated`
      );

      return response.json({
        success: true,
        message: 'Recalculation complete',
        guildId,
        processedUsers: processedCount,
        updatedLevels: updatedCount,
      });
    } catch (error) {
      this.container.logger.error('Error recalculating XP:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
