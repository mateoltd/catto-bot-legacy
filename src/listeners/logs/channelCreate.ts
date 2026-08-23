import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class ChannelCreateListener extends LogListener<typeof Events.ChannelCreate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.ChannelCreate,
    });
  }

  public async run(channel: GuildChannel) {
    if (!channel.guild) return;

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
      title: 'Channel Created',
      description: `Channel ${channel} was created`,
      fields: [
        { name: 'Name', value: channel.name, inline: true },
        { name: 'Type', value: channelTypes[channel.type] || 'Unknown', inline: true },
        { name: 'ID', value: channel.id, inline: true },
        ...(channel.parentId
          ? [{ name: 'Category', value: `<#${channel.parentId}>`, inline: true }]
          : []),
      ],
      color: 0x57f287, // Green
    });
  }
}
