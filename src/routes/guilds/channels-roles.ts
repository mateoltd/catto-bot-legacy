import { Route } from '@sapphire/plugin-api';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

export class GuildChannelsRolesRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/channels-roles',
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

    try {
      // Get Discord guild
      const guild = this.container.client.guilds.cache.get(guildId);

      if (!guild) {
        return response.status(404).json({
          error: 'Guild not found or bot is not in the guild',
        });
      }

      // Get text channels
      const textChannels = guild.channels.cache
        .filter((channel) => channel.type === ChannelType.GuildText)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: 'text' as const,
          parentId: channel.parentId,
          canSend: guild.members.me
            ? (channel
                .permissionsFor(guild.members.me)
                ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]) ?? false)
            : false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get voice channels
      const voiceChannels = guild.channels.cache
        .filter(
          (channel) =>
            channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice
        )
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type === ChannelType.GuildVoice ? ('voice' as const) : ('stage' as const),
          parentId: channel.parentId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get categories
      const categories = guild.channels.cache
        .filter((channel) => channel.type === ChannelType.GuildCategory)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: 'category' as const,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get roles (exclude @everyone)
      const roles = guild.roles.cache
        .filter((role) => role.id !== guild.id)
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          editable: role.editable,
          managed: role.managed,
        }))
        .sort((a, b) => b.position - a.position);

      return response.json({
        success: true,
        channels: [...textChannels, ...voiceChannels, ...categories],
        roles,
      });
    } catch (error) {
      this.container.logger.error('Error fetching guild channels and roles:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
