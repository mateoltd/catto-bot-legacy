import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { DMChannel, GuildChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class ChannelDeleteListener extends LogListener<typeof Events.ChannelDelete> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.ChannelDelete,
    });
  }

  public async run(channel: DMChannel | GuildChannel) {
    if (channel.isDMBased()) return;

    const channelTypes: Record<number, string> = {
      [ChannelType.GuildText]: 'Text',
      [ChannelType.GuildVoice]: 'Voice',
      [ChannelType.GuildCategory]: 'Category',
      [ChannelType.GuildAnnouncement]: 'Announcement',
      [ChannelType.AnnouncementThread]: 'Announcement Thread',
      [ChannelType.PublicThread]: 'Public Thread',
      [ChannelType.PrivateThread]: 'Private Thread',
      [ChannelType.GuildStageVoice]: 'Stage',
      [ChannelType.GuildForum]: 'Forum',
    };

    await logAction({
      guildId: channel.guild.id,
      type: LogType.Channels,
      title: 'Channel Deleted',
      description: `Channel **${channel.name}** was deleted`,
      fields: [
        { name: 'Name', value: channel.name, inline: true },
        { name: 'Type', value: channelTypes[channel.type] || 'Unknown', inline: true },
        { name: 'ID', value: channel.id, inline: true },
        ...(channel.parentId
          ? [{ name: 'Category', value: `<#${channel.parentId}>`, inline: true }]
          : []),
      ],
      color: 0xed4245, // Red
    });
  }
}
