/**
 * Voice State Update Listener
 * Handles voice channel joins, leaves, moves, and state changes
 */

import { Listener } from '@sapphire/framework';
import { Events, VoiceState } from 'discord.js';
import {
  handleVoiceJoin,
  handleVoiceLeave,
  handleVoiceMove,
  handleVoiceStateUpdate,
} from '../../modules/xp/xp-voice/services/voice-xp-session.service.js';

export class VoiceXPStateUpdateListener extends Listener<typeof Events.VoiceStateUpdate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.VoiceStateUpdate,
      name: 'voiceXPStateUpdateListener',
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState): Promise<void> {
    try {
      const oldChannelId = oldState.channelId;
      const newChannelId = newState.channelId;

      // User joined voice channel
      if (!oldChannelId && newChannelId) {
        await handleVoiceJoin(newState);
      }
      // User left voice channel
      else if (oldChannelId && !newChannelId) {
        await handleVoiceLeave(oldState);
      }
      // User moved to different voice channel
      else if (oldChannelId !== newChannelId && oldChannelId && newChannelId) {
        await handleVoiceMove(oldState, newState);
      }
      // User state changed (muted, deafened, streaming, video)
      else if (oldChannelId === newChannelId && newChannelId) {
        await handleVoiceStateUpdate(oldState, newState);
      }
    } catch (error) {
      this.container.logger.error('[Voice XP] Error handling voice state update:', error);
    }
  }
}
