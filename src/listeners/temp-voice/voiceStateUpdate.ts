import { Listener } from "@sapphire/framework";
import { Events, type VoiceState } from "discord.js";

import { getTempVoiceTransport } from "#modules/temp-voice/application/temp-voice-runtime.js";

export class TempVoiceStateUpdateListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: Events.VoiceStateUpdate,
      name: "tempVoiceStateUpdateListener",
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    try {
      await getTempVoiceTransport().publish({
        kind: "VOICE_STATE_OBSERVED",
        guildId: newState.guild.id,
        userId: member.id,
        oldChannelId: oldState.channelId,
        newChannelId: newState.channelId,
        observedAt: Date.now(),
      });
    } catch (error) {
      this.container.logger.error(
        `[TempVoiceAdapter] Failed to publish voice state for ${member.id}:`,
        error,
      );
    }
  }
}
