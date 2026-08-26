/**
 * GET /api/guilds/[guildId]/temp-voice/stats
 * Get statistics about temporary voice channels in a guild
 */

import { Route } from "@sapphire/plugin-api";
import { TempChannelService } from "#modules/temp-voice/services/temp-channel.service.js";
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from "#modules/temp-voice/services/config-api.service.js";
import { ChannelType } from "discord.js";
import { TempVoiceOwnershipStatus } from "@prisma/client";
import { ApiGate } from "#lib/validation/ApiGate.js";

export class TempVoiceStatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: "guilds/[guildId]/temp-voice/stats",
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
      const auth = await gate.checkAuth("tempvoice.view");
      if (!auth.ok) {
        return response
          .status(403)
          .json({ error: "Forbidden", code: auth.code });
      }

      // Get config
      const config = await TempVoiceConfigService.getConfig(guildId);

      if (!config) {
        return response.status(404).json({
          success: false,
          error: {
            code: "CONFIG_NOT_FOUND",
            message: "Temp Voice configuration not found for this guild",
          },
        });
      }

      // Get all temp channels
      const tempChannels =
        await TempChannelService.getGuildTempChannels(guildId);
      const totalChannelsCreated =
        await this.container.prisma.tempVoiceChannel.count({
          where: { guildId },
        });

      // Get guild
      const guild = this.container.client.guilds.cache.get(guildId);
      if (!guild) {
        return response.status(404).json({
          success: false,
          error: {
            code: "GUILD_NOT_FOUND",
            message: "Guild not found",
          },
        });
      }

      // Count active channels and gather stats
      let activeCount = 0;
      let totalMembers = 0;
      let emptyCount = 0;
      const ownerCounts = new Map<string, number>();

      for (const tc of tempChannels) {
        if (!tc.channelId) continue;

        const channel = guild.channels.cache.get(tc.channelId);

        if (channel && channel.type === ChannelType.GuildVoice) {
          activeCount++;
          totalMembers += channel.members.size;

          if (channel.members.size === 0) {
            emptyCount++;
          }

          // Count channels per owner
          if (tc.ownershipStatus !== TempVoiceOwnershipStatus.CLAIMABLE) {
            const currentCount = ownerCounts.get(tc.ownerId) || 0;
            ownerCounts.set(tc.ownerId, currentCount + 1);
          }
        }
      }

      // Get most active owner
      let mostActiveOwner = null;
      let maxChannels = 0;
      for (const [ownerId, count] of ownerCounts.entries()) {
        if (count > maxChannels) {
          maxChannels = count;
          mostActiveOwner = ownerId;
        }
      }

      // Calculate average members per channel
      const avgMembersPerChannel =
        activeCount > 0 ? totalMembers / activeCount : 0;

      // Get join channel details
      const joinChannels = config.joinChannelIds.map((id) => {
        const channel = guild.channels.cache.get(id);
        return {
          id,
          name: channel?.name || "Unknown",
          exists: !!channel,
        };
      });

      return response.json({
        success: true,
        data: {
          guildId,
          config: {
            enabled: config.enabled,
            joinChannelCount: config.joinChannelIds.length,
            joinChannels,
            maxChannelsPerUser: config.maxChannelsPerUser,
          },
          stats: {
            totalChannelsCreated,
            activeChannels: activeCount,
            emptyChannels: emptyCount,
            totalMembers,
            averageMembersPerChannel:
              Math.round(avgMembersPerChannel * 100) / 100,
            uniqueOwners: ownerCounts.size,
            mostActiveOwner: mostActiveOwner
              ? {
                  userId: mostActiveOwner,
                  username:
                    guild.members.cache.get(mostActiveOwner)?.user.username,
                  channelCount: maxChannels,
                }
              : null,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice API] Error fetching stats:",
        error,
      );

      return response.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while fetching statistics",
        },
      });
    }
  }
}
