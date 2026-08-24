import { Route } from '@sapphire/plugin-api';
import { extractSessionId, isSessionId, resolveSession } from '#lib/session.js';
import { parseRequestBody } from '#lib/route-utils.js';
import { MODERATION_DASHBOARD_PERMISSIONS } from '#lib/validation/moderationDashboardPermissions.js';
import { checkCommandAccess } from '#lib/validation/permissionResolver.js';

export class AccessibleGuildsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/accessible',
      methods: ['POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    try {
      const sessionId = extractSessionId(request);
      if (!sessionId || !isSessionId(sessionId)) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }

      const session = await resolveSession(sessionId);
      if (!session) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }

      const userId = session.userId;

      const body = (await parseRequestBody(request)) as { guildIds?: string[] } | undefined;
      if (!body?.guildIds || !Array.isArray(body.guildIds)) {
        return response.status(400).json({ error: 'guildIds array is required' });
      }

      const guildIds = body.guildIds.slice(0, 200);

      const results = await Promise.allSettled(
        guildIds.map(async (guildId) => {
          const discordGuild = this.container.client.guilds.cache.get(guildId);
          if (!discordGuild) return null;

          let member;
          try {
            member = await discordGuild.members.fetch(userId);
          } catch {
            return null;
          }

          if (member.permissions.has('Administrator')) return guildId;

          for (const key of MODERATION_DASHBOARD_PERMISSIONS) {
            const result = await checkCommandAccess(member, key);
            if (result.allowed) return guildId;
          }

          return null;
        })
      );

      const accessibleIds = results
        .filter(
          (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value);

      return response.json({ guildIds: accessibleIds });
    } catch (error) {
      this.container.logger.error('Error checking accessible guilds:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
