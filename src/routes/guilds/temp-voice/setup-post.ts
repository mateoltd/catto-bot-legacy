/**
 * POST /api/guilds/[guildId]/temp-voice/setup
 * Auto-setup Temp Voice system (creates category, join channel, logs channel with webhook, and config)
 */

import { Route } from '@sapphire/plugin-api';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from '#modules/temp-voice/services/config-api.service.js';
import { container } from '@sapphire/framework';
import type { RouteRequestWithBody } from '#root/lib/route-types.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceSetupPostRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/setup',
      methods: ['POST'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handlePost(request as RouteRequestWithBody, response);
  }

  private async handlePost(request: RouteRequestWithBody, response: Route.Response) {
    try {
      const guildId = request.params.guildId;

      // Log raw request for debugging
      this.container.logger.debug('[TempVoice API] Setup request received');
      this.container.logger.debug('[TempVoice API] Body:', request.body);
      this.container.logger.debug('[TempVoice API] Headers:', request.headers);

      // Parse body if it's a string
      let body: unknown = request.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      // Default to empty object if body is undefined
      if (!body) {
        body = {};
      }

      if (!guildId) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_GUILD_ID',
            message: 'Guild ID is required',
          },
        });
      }

      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }
      const auth = await gate.checkAuth('tempvoice.config');
      if (!auth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: auth.code });
      }

      // Get guild
      const guild = this.container.client.guilds.cache.get(guildId);
      if (!guild) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'GUILD_NOT_FOUND',
            message: 'Guild not found or bot is not in the guild',
          },
        });
      }

      // Check if config already exists
      const existingConfig = await TempVoiceConfigService.getConfig(guildId);
      if (existingConfig) {
        return response.status(409).json({
          success: false,
          error: {
            code: 'CONFIG_ALREADY_EXISTS',
            message: 'Temp Voice configuration already exists for this guild',
          },
          data: {
            guildId,
            suggestion:
              'Use PATCH /api/guilds/[guildId]/temp-voice/config to update existing configuration',
          },
        });
      }

      // Extract options from body
      const bodyObj = body as Record<string, unknown>;
      const categoryName = (bodyObj?.categoryName as string) || 'Temp Voice Channels';
      const joinChannelName = (bodyObj?.joinChannelName as string) || '➕ Join to Create';
      const logsChannelName = (bodyObj?.logsChannelName as string) || '📝 temp-voice-logs';

      this.container.logger.info(`[TempVoice API] Starting auto-setup for guild ${guildId}`);

      // 1. Create category
      const category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          },
        ],
      });

      this.container.logger.info(
        `[TempVoice API] Created category: ${category.name} (${category.id})`
      );

      // 2. Create join-to-create voice channel
      const joinChannel = await guild.channels.create({
        name: joinChannelName,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          },
        ],
      });

      this.container.logger.info(
        `[TempVoice API] Created join channel: ${joinChannel.name} (${joinChannel.id})`
      );

      // 3. Create admin-only logs channel
      const logsChannel = await guild.channels.create({
        name: logsChannelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      this.container.logger.info(
        `[TempVoice API] Created logs channel: ${logsChannel.name} (${logsChannel.id})`
      );

      // 4. Create webhook in logs channel
      const webhook = await logsChannel.createWebhook({
        name: 'Temp Voice Logger',
        avatar: this.container.client.user?.displayAvatarURL(),
        reason: 'Auto-setup: Temp Voice logging webhook',
      });

      const webhookUrl = webhook.url;
      this.container.logger.info(`[TempVoice API] Created webhook for logs channel`);

      // 5. Create temp voice configuration
      const configData = {
        enabled: true,
        namingScheme: 'username' as const,
        customNamingPattern: null,
        userLimit: undefined,
        bitrate: undefined,
        defaultCategoryId: category.id,
        autoDeleteEmpty: true,
        deleteEmptyAfterMs: 300000, // 5 minutes
        autoDeleteOwnerLeave: true,
        deleteOwnerLeaveAfterMs: 0, // Immediately
        allowOwnerTransfer: true,
        allowOwnerManagement: true,
        maxChannelsPerUser: 3,
        logChannelId: logsChannel.id,
        logWebhook: webhookUrl,
      };

      await TempVoiceConfigService.createConfig(guildId, configData);

      this.container.logger.info(`[TempVoice API] Created config for guild ${guildId}`);

      // 6. Add join channel to config's join-to-create channels
      const dbUpdate = await container.prisma.tempVoiceConfig.update({
        where: { guildId },
        data: {
          joinToCreateChannels: [joinChannel.id],
        },
      });

      this.container.logger.info(
        `[TempVoice API] DB update result:`,
        dbUpdate.joinToCreateChannels
      );

      // 7. Fetch the updated config
      const updatedConfig = await TempVoiceConfigService.getConfig(guildId);

      this.container.logger.info(
        `[TempVoice API] Final config joinChannelIds:`,
        updatedConfig?.joinChannelIds
      );

      return response.status(201).json({
        success: true,
        message: 'Temp Voice system setup completed successfully',
        data: {
          category: {
            id: category.id,
            name: category.name,
          },
          joinChannel: {
            id: joinChannel.id,
            name: joinChannel.name,
          },
          logsChannel: {
            id: logsChannel.id,
            name: logsChannel.name,
          },
          config: updatedConfig,
          instructions:
            'Users can now join the "Join to Create" channel to automatically create their own temporary voice channel! Logs will appear in the admin-only logs channel.',
        },
      });
    } catch (error) {
      this.container.logger.error('[TempVoice API] Error during auto-setup:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during auto-setup',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}
