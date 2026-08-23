import { Route } from '@sapphire/plugin-api';
import { ChannelType, PermissionFlagsBits, type TextChannel } from 'discord.js';
import { LOG_CHANNEL_DEFINITIONS } from '#lib/constants/logging.constants.js';

interface ToggleRequest {
  logType: string;
  enabled: boolean;
}

export class LoggingToggleRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/logging/toggle',
      methods: ['PATCH'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;
    const body = (await request.readBodyJson()) as ToggleRequest;

    if (!guildId || !body?.logType) {
      return response.status(400).json({
        error: 'Guild ID and logType are required',
      });
    }

    const definition =
      LOG_CHANNEL_DEFINITIONS[body.logType as keyof typeof LOG_CHANNEL_DEFINITIONS];
    if (!definition) {
      return response.status(400).json({
        error: `Invalid log type: ${body.logType}`,
        availableTypes: Object.keys(LOG_CHANNEL_DEFINITIONS),
      });
    }

    // Get current config
    const config = await this.container.prisma.logConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return response.status(404).json({
        error: 'Logging system not set up. Run setup first.',
      });
    }

    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found',
      });
    }

    try {
      let webhookUrl = (config as Record<string, unknown>)[definition.webhookField] as
        | string
        | null
        | undefined;

      // If enabling and no webhook exists, create channel and webhook
      if (body.enabled && !webhookUrl) {
        const botMember = guild.members.me;
        if (!botMember) {
          return response.status(500).json({
            error: 'Bot member not found',
          });
        }

        // Create channel
        const channel = (await guild.channels.create({
          name: definition.name,
          type: ChannelType.GuildText,
          parent: config.categoryId || undefined,
          topic: definition.description,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: botMember.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageWebhooks,
              ],
            },
          ],
        })) as TextChannel;

        // Create webhook
        const webhook = await channel.createWebhook({
          name: `${botMember.user.username} Logs`,
          avatar: botMember.user.displayAvatarURL(),
          reason: 'Logging channel enabled',
        });

        webhookUrl = webhook.url;
      }

      // Update database
      await this.container.prisma.logConfig.update({
        where: { guildId },
        data: {
          [definition.enabledField]: body.enabled,
          ...(webhookUrl && { [definition.webhookField]: webhookUrl }),
        },
      });

      return response.json({
        success: true,
        logType: body.logType,
        enabled: body.enabled,
        message: `${definition.name} ${body.enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      this.container.logger.error(`Failed to toggle ${body.logType}:`, error);
      return response.status(500).json({
        error: 'Failed to toggle log type',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
