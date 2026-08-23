import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildEmoji } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class EmojiUpdateListener extends LogListener<typeof Events.GuildEmojiUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildEmojiUpdate,
    });
  }

  public async run(oldEmoji: GuildEmoji, newEmoji: GuildEmoji) {
    const changes: Array<{ name: string; value: string }> = [];

    if (oldEmoji.name !== newEmoji.name) {
      changes.push({
        name: 'Name',
        value: `**Before:** ${oldEmoji.name}\n**After:** ${newEmoji.name}`,
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newEmoji.guild.id,
      type: LogType.Emojis,
      title: 'Emoji Updated',
      description: `Emoji ${newEmoji} was updated`,
      fields: [
        { name: 'Emoji', value: `${newEmoji} (${newEmoji.id})`, inline: true },
        { name: 'Animated', value: newEmoji.animated ? 'Yes' : 'No', inline: true },
        ...changes,
      ],
      color: 0xfee75c, // Yellow
      thumbnail: newEmoji.url,
    });
  }
}
