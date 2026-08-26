/**
 * GET /api/guilds/[guildId]/temp-voice/channels
 * List all active temporary voice channels in a guild
 */

import { Route } from "@sapphire/plugin-api";
import { TempChannelService } from "#modules/temp-voice/services/temp-channel.service.js";
import { ChannelType } from "discord.js";
import { TempVoiceOwnershipStatus } from "@prisma/client";
import { ApiGate } from "#lib/validation/ApiGate.js";

export class TempVoiceChannelsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: "guilds/[guildId]/temp-voice/channels",
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

      // Get all active temp channels for this guild
      const tempChannels =
        await TempChannelService.getGuildTempChannels(guildId);

      // Get guild to fetch channel details
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

      // Fetch detailed information for each channel
      const channelsWithDetails = await Promise.all(
        tempChannels.map(async (tc) => {
          const ownerId =
            tc.ownershipStatus === TempVoiceOwnershipStatus.CLAIMABLE
              ? null
              : tc.ownerId;
          const channel = tc.channelId
            ? guild.channels.cache.get(tc.channelId)
            : null;

          if (!channel || channel.type !== ChannelType.GuildVoice) {
            return {
              aggregateId: tc.id,
              channelId: tc.channelId,
              ownerId,
              createdAt: tc.createdAt,
              lifecycle: tc.lifecycle,
              ownershipStatus: tc.ownershipStatus,
              claimableAt: tc.claimableAt,
              deleteAfter: tc.deleteAfter,
              lastError: tc.lastErrorMessage,
              status: tc.lifecycle === "CREATING" ? "creating" : "unavailable",
            };
          }

          // Get current members
          const members = channel.members.map((m) => ({
            id: m.id,
            username: m.user.username,
            displayName: m.displayName,
            avatar: m.user.displayAvatarURL(),
          }));

          const permissions = {
            isLocked: tc.isLocked,
            isHidden: tc.isHidden,
            allowedUserIds: tc.allowedUserIds,
            deniedUserIds: tc.deniedUserIds,
            trustedUserIds: tc.trustedUserIds,
          };

          return {
            aggregateId: tc.id,
            channelId: tc.channelId,
            channelName: channel.name,
            ownerId,
            ownerUsername: ownerId
              ? guild.members.cache.get(ownerId)?.user.username
              : undefined,
            categoryId: channel.parentId,
            categoryName: channel.parent?.name,
            userLimit: channel.userLimit,
            bitrate: channel.bitrate,
            memberCount: channel.members.size,
            members,
            permissions,
            createdAt: tc.createdAt,
            lifecycle: tc.lifecycle,
            ownershipStatus: tc.ownershipStatus,
            claimableAt: tc.claimableAt,
            deleteAfter: tc.deleteAfter,
            lastError: tc.lastErrorMessage,
            status: "active",
          };
        }),
      );

      return response.json({
        success: true,
        data: {
          guildId,
          totalChannels: channelsWithDetails.length,
          channels: channelsWithDetails,
        },
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice API] Error listing channels:",
        error,
      );

      return response.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while listing temporary channels",
        },
      });
    }
  }
}
