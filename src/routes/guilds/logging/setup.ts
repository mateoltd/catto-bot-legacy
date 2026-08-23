import { Route } from '@sapphire/plugin-api';
import { ChannelType, PermissionFlagsBits, type TextChannel } from 'discord.js';
import { LOG_CHANNEL_DEFINITIONS } from '#lib/constants/logging.constants.js';
import type { LogSetupResponse } from '#lib/types/logging.types.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { LogSetupDto } from '#lib/dtos/logging/logging-config.dto.js';

export class LoggingSetupRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/logging/setup',
      methods: ['POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    // Parse request body
    const body = await request.readBodyJson();

    // Validate request body
    const validation = await validateDto(LogSetupDto, body);
    if (!validation.success) {
      return response.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    if (!validation.data) {
      return response.status(400).json({ error: 'Invalid request data' });
    }

    const { enabledTypes, categoryName = '📋 Admin Logs' } = validation.data;

    // Verify all enabled types are valid
    const invalidTypes = enabledTypes.filter(
      (type: string) => !LOG_CHANNEL_DEFINITIONS[type as keyof typeof LOG_CHANNEL_DEFINITIONS]
    );

    if (invalidTypes.length > 0) {
      return response.status(400).json({
        error: `Invalid log types: ${invalidTypes.join(', ')}`,
        availableTypes: Object.keys(LOG_CHANNEL_DEFINITIONS),
      });
    }

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    // Check bot permissions
    const botMember = guild.members.me;
    if (!botMember) {
      return response.status(500).json({
        error: 'Bot member not found',
      });
    }

    const requiredPermissions = [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageWebhooks,
    ];

    const missingPermissions = requiredPermissions.filter(
      (perm) => !botMember.permissions.has(perm)
    );

    if (missingPermissions.length > 0) {
      return response.status(403).json({
        error: 'Bot is missing required permissions: Manage Channels, Manage Webhooks',
      });
    }

    try {
      // Create or get the category
      const category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: botMember.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageWebhooks,
            ],
          },
        ],
      });

      const webhookUrls: Record<string, string> = {};
      const enabledFields: Record<string, boolean> = {};
      const errors: string[] = [];
      let channelsCreated = 0;

      // Create channels only for enabled types
      for (const typeKey of enabledTypes) {
        const definition = LOG_CHANNEL_DEFINITIONS[typeKey as keyof typeof LOG_CHANNEL_DEFINITIONS];
        if (!definition) continue;

        try {
          // Create channel
          const channel = (await guild.channels.create({
            name: definition.name,
            type: ChannelType.GuildText,
            parent: category.id,
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
            reason: 'Logging system setup',
          });

          webhookUrls[definition.webhookField] = webhook.url;
          enabledFields[definition.enabledField] = true;
          channelsCreated++;

          // Add a small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (err) {
          this.container.logger.error(`Failed to create channel for ${typeKey}:`, err);
          errors.push(`Failed to create ${definition.name}`);
        }
      }

      // Prepare database update
      const updateData: Record<string, unknown> = {
        categoryId: category.id,
        enabled: true,
        updatedAt: new Date(),
        ...webhookUrls,
        ...enabledFields,
      };

      // Save to database
      await this.container.prisma.logConfig.upsert({
        where: { guildId },
        update: updateData,
        create: {
          guildId,
          ...updateData,
        },
      });

      const responseData: LogSetupResponse = {
        success: true,
        message: 'Logging system setup successfully',
        categoryId: category.id,
        channelsCreated,
        enabledTypes,
      };

      if (errors.length > 0) {
        responseData.errors = errors;
      }

      return response.json(responseData);
    } catch (err) {
      this.container.logger.error('Error setting up logging system:', err);
      return response.status(500).json({
        error: 'Failed to set up logging system',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
