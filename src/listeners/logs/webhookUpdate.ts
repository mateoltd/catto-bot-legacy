import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildChannel } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class WebhookUpdateListener extends LogListener<typeof Events.WebhooksUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.WebhooksUpdate,
    });
  }

  public async run(channel: GuildChannel) {
    // Check if channel should be ignored
    if (await this.shouldIgnoreChannel(channel.guild.id, channel.id)) return;

    // This event doesn't provide detailed webhook information,
    // so we just log that webhooks were updated
    await logAction({
      guildId: channel.guild.id,
      type: LogType.Webhooks,
      title: 'Webhooks Updated',
      description: `Webhooks for channel ${channel} were updated`,
      fields: [{ name: 'Channel', value: `${channel} (${channel.id})`, inline: true }],
      color: 0xfee75c, // Yellow
    });
  }
}
