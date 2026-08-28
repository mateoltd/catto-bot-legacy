import { Route } from '@sapphire/plugin-api';
import { PermissionFlagsBits } from 'discord.js';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { vanityCleanupService } from '#modules/vanity/index.js';

export class VanityCleanupStatusRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/vanity/cleanup/[jobId]',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const guildId = request.params.guildId;
    const jobId = request.params.jobId;
    if (!guildId || !jobId) {
      return response.status(400).json({ error: 'Guild ID and cleanup job ID are required' });
    }

    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate) return response.status(401).json({ error: 'Unauthorized' });
    if (!gate.isOwner && !gate.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return response.status(403).json({ error: 'Manage Server permission is required' });
    }

    const cleanup = await vanityCleanupService.getStatus(jobId);
    if (!cleanup || cleanup.guildId !== guildId) {
      return response.status(404).json({ error: 'Cleanup job not found' });
    }

    return response.json({ success: true, cleanup });
  }
}
