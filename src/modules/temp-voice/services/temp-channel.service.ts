import {
  TempVoiceLifecycle,
  type PrismaClient,
  type TempVoiceChannel,
} from "@prisma/client";
import { container } from "@sapphire/framework";

const normalize = (channel: TempVoiceChannel): TempVoiceChannel => ({
  ...channel,
  allowedUserIds: Array.isArray(channel.allowedUserIds)
    ? channel.allowedUserIds
    : [],
  deniedUserIds: Array.isArray(channel.deniedUserIds)
    ? channel.deniedUserIds
    : [],
  trustedUserIds: Array.isArray(channel.trustedUserIds)
    ? channel.trustedUserIds
    : [],
  managedUserIds: Array.isArray(channel.managedUserIds)
    ? channel.managedUserIds
    : [],
  metadata:
    channel.metadata && typeof channel.metadata === "object"
      ? channel.metadata
      : {},
});

/** Read-only compatibility facade. Mutations belong to TempVoiceCoordinator. */
export class TempChannelService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getByChannelId(
    channelId: string,
  ): Promise<TempVoiceChannel | null> {
    const channel = await this.prisma.tempVoiceChannel.findUnique({
      where: { channelId },
    });
    return channel ? normalize(channel) : null;
  }

  public async getByGuildId(guildId: string): Promise<TempVoiceChannel[]> {
    const channels = await this.prisma.tempVoiceChannel.findMany({
      where: { guildId, lifecycle: { not: TempVoiceLifecycle.DELETED } },
      orderBy: { createdAt: "asc" },
    });
    return channels.map(normalize);
  }

  public static async getGuildTempChannels(
    guildId: string,
  ): Promise<TempVoiceChannel[]> {
    const channels = await container.prisma.tempVoiceChannel.findMany({
      where: { guildId, lifecycle: { not: TempVoiceLifecycle.DELETED } },
      orderBy: { createdAt: "asc" },
    });
    return channels.map(normalize);
  }
}
