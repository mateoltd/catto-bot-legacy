import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildEmoji } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class EmojiDeleteListener extends LogListener<typeof Events.GuildEmojiDelete> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildEmojiDelete,
    });
  }

  public async run(emoji: GuildEmoji) {
    await logAction({
      guildId: emoji.guild.id,
      type: LogType.Emojis,
      title: 'Emoji Deleted',
      description: `Emoji **:${emoji.name}:** was deleted`,
      fields: [
        { name: 'Name', value: emoji.name || 'Unknown', inline: true },
        { name: 'ID', value: emoji.id, inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
      ],
      color: 0xed4245, // Red
      thumbnail: emoji.url,
    });
  }
}
