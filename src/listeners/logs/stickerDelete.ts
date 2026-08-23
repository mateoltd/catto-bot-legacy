import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Sticker } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class StickerDeleteListener extends LogListener<typeof Events.GuildStickerDelete> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildStickerDelete,
    });
  }

  public async run(sticker: Sticker) {
    if (!sticker.guild) return;

    await logAction({
      guildId: sticker.guild.id,
      type: LogType.Stickers,
      title: 'Sticker Deleted',
      description: `Sticker **${sticker.name}** was deleted`,
      fields: [
        { name: 'Name', value: sticker.name, inline: true },
        { name: 'ID', value: sticker.id, inline: true },
        { name: 'Description', value: sticker.description || '*No description*' },
      ],
      color: 0xed4245, // Red
      thumbnail: sticker.url,
    });
  }
}
