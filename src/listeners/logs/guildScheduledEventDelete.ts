import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildScheduledEvent } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { time, TimestampStyles } from '@discordjs/builders';
import { LogListener } from './LogListener.js';

export class GuildScheduledEventDeleteListener extends LogListener<
  typeof Events.GuildScheduledEventDelete
> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildScheduledEventDelete,
    });
  }

  public async run(event: GuildScheduledEvent) {
    // Check if channel should be ignored (for channel-based events)
    if (event.channelId && (await this.shouldIgnoreChannel(event.guildId, event.channelId))) return;
    await logAction({
      guildId: event.guildId,
      type: LogType.Events,
      title: 'Scheduled Event Deleted',
      description: `Event **${event.name}** was deleted`,
      fields: [
        { name: 'Name', value: event.name, inline: true },
        ...(event.scheduledStartAt
          ? [
              {
                name: 'Scheduled Start',
                value: time(event.scheduledStartAt, TimestampStyles.LongDateTime),
                inline: true,
              },
            ]
          : []),
        ...(event.description
          ? [{ name: 'Description', value: event.description.substring(0, 1024) }]
          : []),
      ],
      color: 0xed4245, // Red
      thumbnail: event.coverImageURL() || undefined,
    });
  }
}
