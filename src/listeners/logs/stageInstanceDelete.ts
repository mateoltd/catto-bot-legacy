import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { StageInstance } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class StageInstanceDeleteListener extends LogListener<typeof Events.StageInstanceDelete> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.StageInstanceDelete,
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
      title: 'Stage Ended',
      description: `A stage was ended in <#${stageInstance.channelId}>`,
      fields: [
        { name: 'Topic', value: stageInstance.topic, inline: true },
        { name: 'Channel', value: `<#${stageInstance.channelId}>`, inline: true },
      ],
      color: 0xed4245, // Red
    });
  }
}
