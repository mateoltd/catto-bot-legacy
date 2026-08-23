import { Route } from '@sapphire/plugin-api';
import { getRegistryForDashboard } from '#lib/validation/permissionRegistry.js';

export class PermissionRegistryRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/permissions/registry',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({ error: 'Guild ID is required' });
    }

    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({ error: 'Guild not found or bot is not in the guild' });
    }

    try {
      const registry = getRegistryForDashboard();

      return response.json({
        categories: registry.categories.map((c) => ({
          key: c.key,
          displayName: c.displayName,
          description: c.description,
          parentCategory: c.parentCategory ?? null,
        })),
        commands: registry.commands.map((cmd) => ({
          key: cmd.key,
          displayName: cmd.displayName,
          categories: cmd.categories,
        })),
      });
    } catch (error) {
      this.container.logger.error('Error fetching permission registry:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
