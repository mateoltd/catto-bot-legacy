import { Listener } from "@sapphire/framework";
import { Events } from "discord.js";

import { getTempVoiceTransport } from "#modules/temp-voice/application/temp-voice-runtime.js";

export class TempVoiceReadyListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      name: "tempVoiceReady",
      once: true,
      event: Events.ClientReady,
    });
  }

  public async run(): Promise<void> {
    const transport = getTempVoiceTransport();
    for (const guildId of this.container.client.guilds.cache.keys()) {
      await transport.publish({
        kind: "RECONCILE_GUILD",
        guildId,
        observedAt: Date.now(),
      });
    }
    this.container.logger.info("[TempVoice] Startup reconciliation queued.");
  }
}
