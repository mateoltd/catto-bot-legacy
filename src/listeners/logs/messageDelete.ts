import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Message, PartialMessage } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class MessageDeleteListener extends LogListener<typeof Events.MessageDelete> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.MessageDelete,
    });
  }

  public async run(message: Message | PartialMessage) {
    // Ignore DMs and bot messages
    if (!message.guild || !message.author || message.author.bot) return;

    // Don't log if message has no content or attachments
    if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) return;

    // Check if channel should be ignored
    if (await this.shouldIgnoreChannel(message.guild.id, message.channel.id)) return;

    await logAction({
      guildId: message.guild.id,
      type: LogType.Messages,
      title: 'Message Deleted',
      description: `Message from ${message.author} deleted in ${message.channel}`,
      fields: [
        { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: 'Channel', value: `${message.channel} (${message.channel.id})`, inline: true },
        ...(message.content
          ? [{ name: 'Content', value: message.content.substring(0, 1024) }]
          : []),
        ...(message.attachments.size > 0
          ? [
              {
                name: `Attachments (${message.attachments.size})`,
                value: message.attachments
                  .map((a) => a.url)
                  .join('\n')
                  .substring(0, 1024),
              },
            ]
          : []),
      ],
      color: 0xed4245, // Red
      footer: `Message ID: ${message.id}`,
    });
  }
}
