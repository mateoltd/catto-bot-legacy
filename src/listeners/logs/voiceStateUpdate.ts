import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { VoiceState } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class LogVoiceStateUpdateListener extends LogListener<typeof Events.VoiceStateUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.VoiceStateUpdate,
      name: 'logVoiceStateUpdateListener',
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState) {
    if (!newState.guild) return;

    const member = newState.member;
    if (!member || member.user.bot) return;

    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      // Check if channel should be ignored
      if (await this.shouldIgnoreChannel(newState.guild.id, newState.channel.id)) return;

      await logAction({
        guildId: newState.guild.id,
        type: LogType.Voice,
        title: 'User Joined Voice Channel',
        description: `${member.user} joined ${newState.channel}`,
        fields: [
          { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
          {
            name: 'Channel',
            value: `${newState.channel.name} (${newState.channel.id})`,
            inline: true,
          },
        ],
        color: 0x57f287, // Green
      });
    }
    // User left a voice channel
    else if (oldState.channel && !newState.channel) {
      // Check if channel should be ignored
      if (await this.shouldIgnoreChannel(newState.guild.id, oldState.channel.id)) return;

      await logAction({
        guildId: newState.guild.id,
        type: LogType.Voice,
        title: 'User Left Voice Channel',
        description: `${member.user} left ${oldState.channel}`,
        fields: [
          { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
          {
            name: 'Channel',
            value: `${oldState.channel.name} (${oldState.channel.id})`,
            inline: true,
          },
        ],
        color: 0xed4245, // Red
      });
    }
    // User moved to a different voice channel
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      // Check if either channel should be ignored - skip if either is ignored
      const ignoreOld = await this.shouldIgnoreChannel(newState.guild.id, oldState.channel.id);
      const ignoreNew = await this.shouldIgnoreChannel(newState.guild.id, newState.channel.id);
      if (ignoreOld || ignoreNew) return; // Skip if either channel is ignored

      await logAction({
        guildId: newState.guild.id,
        type: LogType.Voice,
        title: 'User Switched Voice Channel',
        description: `${member.user} moved from ${oldState.channel} to ${newState.channel}`,
        fields: [
          { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
          { name: 'Previous Channel', value: `${oldState.channel.name}`, inline: true },
          { name: 'New Channel', value: `${newState.channel.name}`, inline: true },
        ],
        color: 0x5865f2, // Blurple
      });
    }
    // Voice state changes (mute, deaf, streaming, etc.)
    else if (oldState.channel && newState.channel) {
      const changes: string[] = [];

      if (oldState.serverMute !== newState.serverMute) {
        changes.push(`**Server Muted:** ${newState.serverMute ? 'Yes' : 'No'}`);
      }
      if (oldState.serverDeaf !== newState.serverDeaf) {
        changes.push(`**Server Deafened:** ${newState.serverDeaf ? 'Yes' : 'No'}`);
      }
      if (oldState.selfMute !== newState.selfMute) {
        changes.push(`**Self Muted:** ${newState.selfMute ? 'Yes' : 'No'}`);
      }
      if (oldState.selfDeaf !== newState.selfDeaf) {
        changes.push(`**Self Deafened:** ${newState.selfDeaf ? 'Yes' : 'No'}`);
      }
      if (oldState.streaming !== newState.streaming) {
        changes.push(`**Streaming:** ${newState.streaming ? 'Yes' : 'No'}`);
      }
      if (oldState.selfVideo !== newState.selfVideo) {
        changes.push(`**Video:** ${newState.selfVideo ? 'Yes' : 'No'}`);
      }

      if (changes.length > 0) {
        // Check if channel should be ignored
        if (await this.shouldIgnoreChannel(newState.guild.id, newState.channel.id)) return;

        await logAction({
          guildId: newState.guild.id,
          type: LogType.VoiceState,
          title: 'Voice State Updated',
          description: `${member.user}'s voice state changed in ${newState.channel}`,
          fields: [
            { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
            { name: 'Channel', value: `${newState.channel.name}`, inline: true },
            { name: 'Changes', value: changes.join('\n') },
          ],
          color: 0xfee75c, // Yellow
        });
      }
    }
  }
}
