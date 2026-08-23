import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { StageInstance } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class StageInstanceUpdateListener extends LogListener<typeof Events.StageInstanceUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.StageInstanceUpdate,
    });
  }

  public async run(oldStageInstance: StageInstance | null, newStageInstance: StageInstance) {
    if (!oldStageInstance) return;

    // Check if channel should be ignored
    if (
      await this.shouldIgnoreChannel(
        newStageInstance.guild?.id || newStageInstance.guildId,
        newStageInstance.channelId
      )
    )
      return;

    const changes: Array<{ name: string; value: string }> = [];

    if (oldStageInstance.topic !== newStageInstance.topic) {
      changes.push({
        name: 'Tema',
        value: `**Antes:** ${oldStageInstance.topic}\n**Después:** ${newStageInstance.topic}`,
      });
    }

    if (oldStageInstance.privacyLevel !== newStageInstance.privacyLevel) {
      changes.push({
        name: 'Privacidad',
        value: `**Antes:** ${oldStageInstance.privacyLevel === 1 ? 'Público' : 'Solo Miembros del Servidor'}\n**Después:** ${newStageInstance.privacyLevel === 1 ? 'Público' : 'Solo Miembros del Servidor'}`,
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newStageInstance.guild?.id || newStageInstance.guildId,
      type: LogType.Stage,
      title: 'Escenario Actualizado',
      description: `Un escenario fue actualizado en <#${newStageInstance.channelId}>`,
      fields: [
        { name: 'Canal', value: `<#${newStageInstance.channelId}>`, inline: true },
        ...changes,
      ],
      color: 0xfee75c, // Yellow
    });
  }
}
