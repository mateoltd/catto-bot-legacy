import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Sticker } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class StickerUpdateListener extends LogListener<typeof Events.GuildStickerUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildStickerUpdate,
    });
  }

  public async run(oldSticker: Sticker, newSticker: Sticker) {
    if (!newSticker.guild) return;

    const changes: Array<{ name: string; value: string }> = [];

    if (oldSticker.name !== newSticker.name) {
      changes.push({
        name: 'Nombre',
        value: `**Antes:** ${oldSticker.name}\n**Después:** ${newSticker.name}`,
      });
    }

    if (oldSticker.description !== newSticker.description) {
      changes.push({
        name: 'Descripción',
        value: `**Antes:** ${oldSticker.description || '*Sin descripción*'}\n**Después:** ${newSticker.description || '*Sin descripción*'}`,
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newSticker.guild.id,
      type: LogType.Stickers,
      title: 'Sticker Actualizado',
      description: `El sticker **${newSticker.name}** fue actualizado`,
      fields: [
        { name: 'Sticker', value: `${newSticker.name} (${newSticker.id})`, inline: true },
        ...changes,
      ],
      color: 0xfee75c, // Yellow
      thumbnail: newSticker.url,
    });
  }
}
