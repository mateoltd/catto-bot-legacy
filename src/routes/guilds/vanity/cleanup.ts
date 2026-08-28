import { Route } from '@sapphire/plugin-api';
import { PermissionFlagsBits } from 'discord.js';
import { ApiGate } from '#lib/validation/ApiGate.js';
import {
  disableVanityConfig,
  getVanityConfig,
  vanityCleanupService,
} from '#modules/vanity/index.js';

export class VanityCleanupRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/vanity/cleanup',
      methods: ['GET', 'POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const guildId = request.params.guildId;
    if (!guildId) return response.status(400).json({ error: 'Guild ID is required' });

    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) return response.status(404).json({ error: 'Guild not found' });

    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate) return response.status(401).json({ error: 'Unauthorized' });
    if (!gate.isOwner && !gate.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return response.status(403).json({ error: 'Manage Server permission is required' });
    }

    if (request.method === 'GET') {
      const cleanup = await vanityCleanupService.getLatestStatus(guildId);
      return response.json({ success: true, cleanup });
    }
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const activeCleanup = await vanityCleanupService.getLatestStatus(guildId);
    if (
      activeCleanup &&
      ['waiting', 'active', 'delayed', 'prioritized'].includes(activeCleanup.state)
    ) {
      return response.status(409).json({
        error: 'A vanity role cleanup is already running',
        cleanup: activeCleanup,
      });
    }

    const config = await getVanityConfig(guildId, true);
    if (!config?.roleId) {
      return response
        .status(409)
        .json({ error: 'No configured vanity role is available to clean' });
    }

    const role = guild.roles.cache.get(config.roleId);
    if (!role) return response.status(409).json({ error: 'The configured role no longer exists' });
    if (!role.editable) {
      return response.status(409).json({ error: 'The configured role is no longer editable' });
    }

    await disableVanityConfig(guildId);
    try {
      const jobId = await vanityCleanupService.schedule(guildId, role.id, gate.userId);
      return response.status(202).json({
        success: true,
        jobId,
        role: { id: role.id, name: role.name },
      });
    } catch (error) {
      this.container.logger.error(`[Vanity] Could not schedule cleanup for ${guildId}:`, error);
      return response.status(503).json({
        error: 'The vanity system was disabled, but cleanup could not be scheduled',
      });
    }
  }
}
