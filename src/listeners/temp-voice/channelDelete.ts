import { Listener } from "@sapphire/framework";
import { Events, type GuildChannel } from "discord.js";

import { getTempVoiceTransport } from "#modules/temp-voice/application/temp-voice-runtime.js";

export class ChannelDeleteListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, { ...options, event: Events.ChannelDelete });
  }

  public async run(channel: GuildChannel): Promise<void> {
    try {
      await getTempVoiceTransport().publish({
        kind: "CHANNEL_DELETED",
        guildId: channel.guild.id,
        channelId: channel.id,
        observedAt: Date.now(),
      });
    } catch (error) {
      this.container.logger.error(
        `[TempVoiceAdapter] Failed to publish channel deletion for ${channel.id}:`,
        error,
      );
    }
  }
}
