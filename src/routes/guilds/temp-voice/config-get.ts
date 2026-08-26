/**
 * GET /api/guilds/[guildId]/temp-voice/config
 * Retrieve Temp Voice configuration for a guild
 */

import { Route } from "@sapphire/plugin-api";
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from "#modules/temp-voice/services/config-api.service.js";
import { ApiGate } from "#lib/validation/ApiGate.js";

export class TempVoiceConfigGetRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: "guilds/[guildId]/temp-voice/config",
      methods: ["GET"],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handleGet(request, response);
  }

  private async handleGet(request: Route.Request, response: Route.Response) {
    try {
      const guildId = request.params.guildId;

      if (!guildId) {
        return response.status(400).json({
          success: false,
          error: {
            code: "MISSING_GUILD_ID",
            message: "Guild ID is required",
          },
        });
      }

      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate) {
        return response
          .status(401)
          .json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" });
      }
      const auth = await gate.checkAuth("tempvoice.config");
      if (!auth.ok) {
        return response
          .status(403)
          .json({ error: "Forbidden", code: auth.code });
      }

      // Get config from database
      const config = await TempVoiceConfigService.getConfig(guildId);

      if (!config) {
        return response.status(404).json({
          success: false,
          error: {
            code: "CONFIG_NOT_FOUND",
            message: "Temp Voice configuration not found for this guild",
          },
          data: {
            guildId,
            suggestion:
              "Create a configuration using POST /api/guilds/[guildId]/temp-voice/config",
          },
        });
      }

      // Return configuration
      return response.json({
        success: true,
        data: {
          guildId: config.guildId,
          enabled: config.enabled,
          joinChannelIds: config.joinChannelIds,
          namingScheme: config.namingScheme,
          customNamingPattern: config.customNamingPattern,
          userLimit: config.userLimit,
          bitrate: config.bitrate,
          defaultCategoryId: config.defaultCategoryId,
          defaultLocked: config.defaultLocked,
          defaultHidden: config.defaultHidden,
          autoDeleteEmpty: config.autoDeleteEmpty,
          deleteEmptyAfterMs: config.deleteEmptyAfterMs,
          ownershipGraceSeconds: config.ownershipGraceSeconds,
          allowOwnerTransfer: config.allowOwnerTransfer,
          controlPanelEnabled: config.controlPanelEnabled,
          allowOwnerManagement: config.allowOwnerManagement,
          maxChannelsPerUser: config.maxChannelsPerUser,
          logChannelId: config.logChannelId,
          enableNameModeration: config.enableNameModeration,
          blockedKeywords: config.blockedKeywords,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice API] Error fetching config:",
        error,
      );

      return response.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while fetching the configuration",
        },
      });
    }
  }
}
