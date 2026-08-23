import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { StageInstance } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class StageInstanceCreateListener extends LogListener<typeof Events.StageInstanceCreate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.StageInstanceCreate,
    });
  }

  public async run(stageInstance: StageInstance) {
    // Check if channel should be ignored
    if (
      await this.shouldIgnoreChannel(
        stageInstance.guild?.id || stageInstance.guildId,
        stageInstance.channelId
      )
    )
      return;

    await logAction({
      guildId: stageInstance.guild?.id || stageInstance.guildId,
      type: LogType.Stage,
      title: 'Stage Started',
      description: `A stage was started in <#${stageInstance.channelId}>`,
      fields: [
        { name: 'Topic', value: stageInstance.topic, inline: true },
        { name: 'Channel', value: `<#${stageInstance.channelId}>`, inline: true },
        {
          name: 'Privacy',
          value: stageInstance.privacyLevel === 1 ? 'Public' : 'Guild Only',
          inline: true,
        },
      ],
      color: 0x57f287, // Green
    });
  }
}
