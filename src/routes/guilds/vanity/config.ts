import { Route } from '@sapphire/plugin-api';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { parseRequestBody } from '#lib/route-utils.js';
import { UpdateVanityConfigDto } from '#lib/dtos/vanity/vanity-config.dto.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { ApiGate } from '#lib/validation/ApiGate.js';
import {
  getVanityConfig,
  reconcileGuildVanity,
  toPublicVanityConfig,
  updateVanityConfig,
  vanityCleanupService,
} from '#modules/vanity/index.js';

export class VanityConfigRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/vanity/config',
      methods: ['GET', 'PUT'],
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
      const config = await getVanityConfig(guildId);
      return response.json({
        success: true,
        config: toPublicVanityConfig(config),
      });
    }
    if (request.method !== 'PUT') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    if (await vanityCleanupService.hasActiveCleanup(guildId)) {
      return response.status(409).json({
        error: 'Vanity settings cannot change while role cleanup is running',
      });
    }

    const body = await parseRequestBody(request);
    const validation = await validateDto(UpdateVanityConfigDto, body);
    if (!validation.success || !validation.data) {
      return response.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    const input = validation.data;
    input.keyword = input.keyword.trim();
    input.thankYouMessage = input.thankYouMessage.trim();

    if (input.enabled && (!input.keyword || !input.roleId)) {
      return response.status(400).json({
        error: 'A keyword and role are required while the vanity system is enabled',
      });
    }
    if (input.thankYouEnabled && (!input.thankYouChannelId || !input.thankYouMessage)) {
      return response.status(400).json({
        error: 'A channel and message are required while thank-you messages are enabled',
      });
    }

    if (input.roleId) {
      const role = guild.roles.cache.get(input.roleId);
      const botMember = guild.members.me;
      if (!role) return response.status(400).json({ error: 'The selected role no longer exists' });
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return response.status(400).json({ error: 'The bot is missing Manage Roles permission' });
      }
      if (role.managed || !role.editable) {
        return response.status(400).json({
          error: 'The selected role must be below the bot role and cannot be integration-managed',
        });
      }
    }

    if (input.thankYouChannelId) {
      const channel = guild.channels.cache.get(input.thankYouChannelId);
      const botMember = guild.members.me;
      const permissions = botMember ? channel?.permissionsFor(botMember) : null;
      if (!channel || channel.type !== ChannelType.GuildText) {
        return response.status(400).json({ error: 'The selected channel must be a text channel' });
      }
      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.SendMessages)
      ) {
        return response.status(400).json({
          error: 'The bot cannot view and send messages in the selected channel',
        });
      }
    }

    const config = await updateVanityConfig(guildId, input);
    void reconcileGuildVanity(guild).catch((error) => {
      this.container.logger.warn(`[Vanity] Post-save reconciliation failed for ${guildId}:`, error);
    });

    return response.json({
      success: true,
      config: toPublicVanityConfig(config),
    });
  }
}
