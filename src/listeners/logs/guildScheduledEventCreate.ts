import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildScheduledEvent } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { time, TimestampStyles } from '@discordjs/builders';
import { LogListener } from './LogListener.js';

export class GuildScheduledEventCreateListener extends LogListener<
  typeof Events.GuildScheduledEventCreate
> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildScheduledEventCreate,
    });
  }

  public async run(event: GuildScheduledEvent) {
    // Check if channel should be ignored (for channel-based events)
    if (event.channelId && (await this.shouldIgnoreChannel(event.guildId, event.channelId))) return;
    await logAction({
      guildId: event.guildId,
      type: LogType.Events,
      title: 'Scheduled Event Created',
      description: `Event **${event.name}** was created`,
      fields: [
        { name: 'Name', value: event.name, inline: true },
        ...(event.scheduledStartAt
          ? [
              {
                name: 'Start',
                value: time(event.scheduledStartAt, TimestampStyles.LongDateTime),
                inline: true,
              },
            ]
          : []),
        ...(event.scheduledEndAt
          ? [
              {
                name: 'End',
                value: time(event.scheduledEndAt, TimestampStyles.LongDateTime),
                inline: true,
              },
            ]
          : []),
        ...(event.description
          ? [{ name: 'Description', value: event.description.substring(0, 1024) }]
          : []),
        ...(event.channelId
          ? [{ name: 'Channel', value: `<#${event.channelId}>`, inline: true }]
          : []),
      ],
      color: 0x57f287, // Green
      thumbnail: event.coverImageURL() || undefined,
    });
  }
}
