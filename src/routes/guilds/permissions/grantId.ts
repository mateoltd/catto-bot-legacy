import { Route } from '@sapphire/plugin-api';
import { invalidateGuildGrantsCache } from '#lib/validation/permissionResolver.js';

export class PermissionGrantByIdRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/permissions/grants/[grantId]',
      methods: ['GET', 'DELETE'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, grantId } = request.params;

    if (!guildId) {
      return response.status(400).json({ error: 'Guild ID is required' });
    }

    if (!grantId) {
      return response.status(400).json({ error: 'Grant ID is required' });
    }

    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({ error: 'Guild not found or bot is not in the guild' });
    }

    if (request.method === 'GET') {
      return this.handleGet(guildId, grantId, response);
    } else if (request.method === 'DELETE') {
      return this.handleDelete(guildId, grantId, response);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  }

  private async handleGet(guildId: string, grantId: string, response: Route.Response) {
    try {
      const grant = await this.container.prisma.permissionGrant.findFirst({
        where: { id: grantId, guildId },
      });

      if (!grant) {
        return response.status(404).json({ error: 'Permission grant not found' });
      }

      return response.json({
        id: grant.id,
        guildId: grant.guildId,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
        resourceType: grant.resourceType,
        resourceKey: grant.resourceKey,
        effect: grant.effect,
        createdById: grant.createdById,
        createdAt: grant.createdAt.toISOString(),
      });
    } catch (error) {
      this.container.logger.error('Error fetching permission grant:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleDelete(guildId: string, grantId: string, response: Route.Response) {
    try {
      const grant = await this.container.prisma.permissionGrant.findFirst({
        where: { id: grantId, guildId },
      });

      if (!grant) {
        return response.status(404).json({ error: 'Permission grant not found' });
      }

      await this.container.prisma.permissionGrant.delete({
        where: { id: grantId },
      });

      await invalidateGuildGrantsCache(guildId);

      return response.status(204).end();
    } catch (error) {
      this.container.logger.error('Error deleting permission grant:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
