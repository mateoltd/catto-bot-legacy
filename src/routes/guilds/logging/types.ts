import { Route } from '@sapphire/plugin-api';
import { LOG_CHANNEL_DEFINITIONS } from '#lib/constants/logging.constants.js';

export class LoggingTypesRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/logging/types',
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

    // Get current configuration
    const config = await this.container.prisma.logConfig.findUnique({
      where: { guildId },
    });

    // Format log types with current status
    const logTypes = Object.entries(LOG_CHANNEL_DEFINITIONS).map(([key, def]) => ({
      key,
      name: def.name,
      description: def.description,
      category: def.category,
      enabled: config
        ? ((config as Record<string, unknown>)[def.enabledField] as boolean) || false
        : false,
      configured: config ? !!(config as Record<string, unknown>)[def.webhookField] : false,
    }));

    // Group by category
    const categorized = {
      core: logTypes.filter((t) => t.category === 'core'),
      advanced: logTypes.filter((t) => t.category === 'advanced'),
    };

    return response.json({
      types: logTypes,
      categorized,
      currentlyEnabled: logTypes.filter((t) => t.enabled).map((t) => t.key),
      isConfigured: !!config,
      categoryId: config?.categoryId || null,
      ignoredChannels: config?.ignoredChannels || [],
    });
  }
}
