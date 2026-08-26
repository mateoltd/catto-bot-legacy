import { container } from "@sapphire/framework";
import { ChannelType } from "discord.js";
import { TempVoiceOwnershipStatus } from "@prisma/client";

export interface TempVoiceOwnershipCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly username: string;
}

export interface TempVoiceOwnershipPage {
  readonly guildId: string;
  readonly channelId: string;
  readonly ownershipEpoch: number;
  readonly page: number;
  readonly pageCount: number;
  readonly candidates: readonly TempVoiceOwnershipCandidate[];
}

export async function getTempVoiceOwnershipPage(input: {
  readonly guildId: string;
  readonly channelId: string;
  readonly actorId: string;
  readonly ownershipEpoch: number;
  readonly page: number;
}): Promise<TempVoiceOwnershipPage | null> {
  const record = await container.prisma.tempVoiceChannel.findUnique({
    where: { channelId: input.channelId },
  });
  if (
    !record ||
    record.guildId !== input.guildId ||
    record.ownerId !== input.actorId ||
    record.ownershipEpoch !== input.ownershipEpoch ||
    record.ownershipStatus !== TempVoiceOwnershipStatus.OWNER_GRACE
  ) {
    return null;
  }

  const guild = container.client.guilds.cache.get(input.guildId);
  if (!guild) return null;
  const channel = await guild.channels.fetch(input.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildVoice) return null;

  const candidates = channel.members
    .filter((member) => !member.user.bot && member.id !== record.ownerId)
    .map((member) => ({
      id: member.id,
      displayName: member.displayName,
      username: member.user.username,
    }));
  const pageCount = Math.max(1, Math.ceil(candidates.length / 25));
  const page = Math.min(Math.max(input.page, 0), pageCount - 1);
  return {
    guildId: input.guildId,
    channelId: input.channelId,
    ownershipEpoch: input.ownershipEpoch,
    page,
    pageCount,
    candidates: candidates.slice(page * 25, page * 25 + 25),
  };
}
