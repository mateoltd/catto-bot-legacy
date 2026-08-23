import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Sticker } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class StickerCreateListener extends LogListener<typeof Events.GuildStickerCreate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildStickerCreate,
    });
  }

  public async run(sticker: Sticker) {
    if (!sticker.guild) return;

    await logAction({
      guildId: sticker.guild.id,
      type: LogType.Stickers,
      title: 'Sticker Created',
      description: `Sticker **${sticker.name}** was created`,
      fields: [
        { name: 'Name', value: sticker.name, inline: true },
        { name: 'ID', value: sticker.id, inline: true },
        { name: 'Description', value: sticker.description || '*No description*' },
        { name: 'URL', value: sticker.url },
      ],
      color: 0x57f287, // Green
      thumbnail: sticker.url,
    });
  }
}
