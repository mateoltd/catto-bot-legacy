/**
 * List Available Templates Route
 * GET /api/guilds/:guildId/rewards/templates
 */

import { Route } from '@sapphire/plugin-api';
import { PRESET_TEMPLATES } from '#root/lib/types/rewards.types.js';

export class TemplatesRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/rewards/templates',
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

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    try {
      const templates = Object.entries(PRESET_TEMPLATES).map(([key, template]) => ({
        key,
        name: template.name,
        description: template.description,
        category: template.category,
        rewardCount: template.rewards.length,
      }));

      return response.json({
        success: true,
        count: templates.length,
        templates,
      });
    } catch (error) {
      this.container.logger.error('Error fetching templates:', error);
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
