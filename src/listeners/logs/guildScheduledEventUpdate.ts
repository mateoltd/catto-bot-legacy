import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildScheduledEvent } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { time, TimestampStyles } from '@discordjs/builders';
import { LogListener } from './LogListener.js';

export class GuildScheduledEventUpdateListener extends LogListener<
  typeof Events.GuildScheduledEventUpdate
> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildScheduledEventUpdate,
    });
  }

  public async run(oldEvent: GuildScheduledEvent | null, newEvent: GuildScheduledEvent) {
    if (!oldEvent) return;

    // Check if channel should be ignored (for channel-based events)
    if (
      newEvent.channelId &&
      (await this.shouldIgnoreChannel(newEvent.guildId, newEvent.channelId))
    )
      return;

    const changes: Array<{ name: string; value: string }> = [];

    if (oldEvent.name !== newEvent.name) {
      changes.push({
        name: 'Name',
        value: `**Before:** ${oldEvent.name}\n**After:** ${newEvent.name}`,
      });
    }

    if (oldEvent.description !== newEvent.description) {
      changes.push({
        name: 'Description',
        value:
          `**Before:** ${oldEvent.description || '*No description*'}\n**After:** ${newEvent.description || '*No description*'}`.substring(
            0,
            1024
          ),
      });
    }

    if (oldEvent.scheduledStartAt?.getTime() !== newEvent.scheduledStartAt?.getTime()) {
      changes.push({
        name: 'Scheduled Start',
        value: `**Before:** ${oldEvent.scheduledStartAt ? time(oldEvent.scheduledStartAt, TimestampStyles.FullDateShortTime) : '*No start time*'}\n**After:** ${newEvent.scheduledStartAt ? time(newEvent.scheduledStartAt, TimestampStyles.LongDateTime) : '*No start time*'}`,
      });
    }

    if (oldEvent.scheduledEndAt?.getTime() !== newEvent.scheduledEndAt?.getTime()) {
      changes.push({
        name: 'Scheduled End',
        value: `**Before:** ${oldEvent.scheduledEndAt ? time(oldEvent.scheduledEndAt, TimestampStyles.LongDateTime) : '*No end*'}\n**After:** ${newEvent.scheduledEndAt ? time(newEvent.scheduledEndAt, TimestampStyles.LongDateTime) : '*No end*'}`,
      });
    }

    if (oldEvent.status !== newEvent.status) {
      const statusNames: Record<number, string> = {
        1: 'Scheduled',
        2: 'Active',
        3: 'Completed',
        4: 'Canceled',
      };

      changes.push({
        name: 'Status',
        value: `**Before:** ${statusNames[oldEvent.status]}\n**After:** ${statusNames[newEvent.status]}`,
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newEvent.guildId,
      type: LogType.Events,
      title: 'Scheduled Event Updated',
      description: `Event **${newEvent.name}** was updated`,
      fields: [
        { name: 'Event', value: `${newEvent.name} (${newEvent.id})`, inline: true },
        ...changes,
      ],
      color: 0xfee75c, // Yellow
      thumbnail: newEvent.coverImageURL() || undefined,
    });
  }
}
