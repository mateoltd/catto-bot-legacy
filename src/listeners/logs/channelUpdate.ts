import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { DMChannel, GuildChannel } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class ChannelUpdateListener extends LogListener<typeof Events.ChannelUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.ChannelUpdate,
    });
  }

  public async run(oldChannel: DMChannel | GuildChannel, newChannel: DMChannel | GuildChannel) {
    if (oldChannel.isDMBased() || newChannel.isDMBased()) return;

    const changes: Array<{ name: string; value: string }> = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push({
        name: 'Name',
        value: `**Before:** ${oldChannel.name}\n**After:** ${newChannel.name}`,
      });
    }

    if ('topic' in oldChannel && 'topic' in newChannel && oldChannel.topic !== newChannel.topic) {
      changes.push({
        name: 'Topic',
        value:
          `**Before:** ${oldChannel.topic || '*No topic*'}\n**After:** ${newChannel.topic || '*No topic*'}`.substring(
            0,
            1024
          ),
      });
    }

    if ('nsfw' in oldChannel && 'nsfw' in newChannel && oldChannel.nsfw !== newChannel.nsfw) {
      changes.push({
        name: 'NSFW',
        value: `**Before:** ${oldChannel.nsfw ? 'Yes' : 'No'}\n**After:** ${newChannel.nsfw ? 'Yes' : 'No'}`,
      });
    }

    if (
      'rateLimitPerUser' in oldChannel &&
      'rateLimitPerUser' in newChannel &&
      oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser
    ) {
      changes.push({
        name: 'Slow Mode',
        value: `**Before:** ${oldChannel.rateLimitPerUser || 0}s\n**After:** ${newChannel.rateLimitPerUser || 0}s`,
      });
    }

    if (oldChannel.parentId !== newChannel.parentId) {
      changes.push({
        name: 'Category',
        value: `**Before:** ${oldChannel.parentId ? `<#${oldChannel.parentId}>` : '*No category*'}\n**After:** ${newChannel.parentId ? `<#${newChannel.parentId}>` : '*No category*'}`,
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newChannel.guild.id,
      type: LogType.Channels,
      title: 'Channel Updated',
      description: `Channel ${newChannel} was updated`,
      fields: [
        { name: 'Channel', value: `${newChannel} (${newChannel.id})`, inline: true },
        ...changes,
      ],
      color: 0xfee75c, // Yellow
    });
  }
}
