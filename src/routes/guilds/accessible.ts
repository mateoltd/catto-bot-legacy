import { Route } from '@sapphire/plugin-api';
import { extractSessionId, isSessionId, resolveSession } from '#lib/session.js';
import { parseRequestBody } from '#lib/route-utils.js';
import { checkCommandAccess } from '#lib/validation/permissionResolver.js';

/** Same permission keys used by dashboard-access.ts */
const DASHBOARD_PERMISSIONS = [
  'mod.evidence.add',
  'mod.evidence.list',
  'mod.evidence.view',
  'mod.evidence.capture',
  'mod.case',
  'mod.history',
  'mod.warn',
  'mod.kick',
  'mod.ban',
  'mod.timeout',
  'mod.note.add',
  'mod.note.list',
  'mod.panel',
] as const;

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
      // Resolve session once
      const sessionId = extractSessionId(request);
      if (!sessionId || !isSessionId(sessionId)) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }

      const session = await resolveSession(sessionId);
      if (!session) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }

      const userId = session.userId;

      // Parse body
      const body = (await parseRequestBody(request)) as { guildIds?: string[] } | undefined;
      if (!body?.guildIds || !Array.isArray(body.guildIds)) {
        return response.status(400).json({ error: 'guildIds array is required' });
      }

      // Cap to prevent abuse
      const guildIds = body.guildIds.slice(0, 100);

      // Batch-check each guild
      const results = await Promise.allSettled(
        guildIds.map(async (guildId) => {
          // 1. Bot must be in the guild
          const discordGuild = this.container.client.guilds.cache.get(guildId);
          if (!discordGuild) return null;

          // 2. User must be a member of the guild
          let member;
          try {
            member = await discordGuild.members.fetch(userId);
          } catch {
            return null;
          }

          // 3. Admins pass immediately
          if (member.permissions.has('Administrator')) return guildId;

          // 4. Check dashboard permissions — short-circuit on first allowed
          for (const key of DASHBOARD_PERMISSIONS) {
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
