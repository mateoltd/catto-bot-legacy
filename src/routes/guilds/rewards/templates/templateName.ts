/**
 * Apply Reward Template Route
 * POST /api/guilds/:guildId/rewards/templates/:templateName
 */

import { Route } from '@sapphire/plugin-api';
import { PRESET_TEMPLATES, RewardService } from '#root/modules/rewards/index.js';

export class ApplyTemplateRoute extends Route {
  private rewardService: RewardService;

  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/rewards/templates/[templateName]',
      methods: ['POST'],
    });
    this.rewardService = new RewardService(this.container.prisma);
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, templateName } = request.params;

    if (!guildId || !templateName) {
      return response.status(400).json({
        error: 'Guild ID and template name are required',
      });
    }

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    // Get template
    const template = PRESET_TEMPLATES[templateName.toUpperCase()];
    if (!template) {
      return response.status(404).json({
        error: 'Template not found',
        availableTemplates: Object.keys(PRESET_TEMPLATES),
      });
    }

    try {
      const createdRewards = [];

      for (const rewardConfig of template.rewards) {
        try {
          const reward = await this.rewardService.createReward({
            ...rewardConfig,
            guildId,
          });
          createdRewards.push(reward);
        } catch (error) {
          // Log but continue with other rewards
          this.container.logger.warn(`Failed to create reward from template: ${error}`);
        }
      }

      return response.status(201).json({
        success: true,
        template: {
          name: template.name,
          description: template.description,
          category: template.category,
        },
        created: createdRewards.length,
        rewards: createdRewards,
      });
    } catch (error) {
      this.container.logger.error('Error applying template:', error);
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
