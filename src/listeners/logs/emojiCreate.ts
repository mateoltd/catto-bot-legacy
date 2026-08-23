import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildEmoji } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class EmojiCreateListener extends LogListener<typeof Events.GuildEmojiCreate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildEmojiCreate,
    });
  }

  public async run(emoji: GuildEmoji) {
    await logAction({
      guildId: emoji.guild.id,
      type: LogType.Emojis,
      title: 'Emoji Created',
      description: `Emoji ${emoji} was created`,
      fields: [
        { name: 'Name', value: emoji.name || 'Unknown', inline: true },
        { name: 'ID', value: emoji.id, inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: 'URL', value: emoji.url },
      ],
      color: 0x57f287, // Green
      thumbnail: emoji.url,
    });
  }
}
