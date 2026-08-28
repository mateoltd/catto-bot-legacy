import { Events, Listener } from '@sapphire/framework';
import type { Presence } from 'discord.js';
import { handleVanityPresence } from '#modules/vanity/runtime.service.js';

export class VanityPresenceUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.PresenceUpdate });
  }

  public async run(_oldPresence: Presence | null, newPresence: Presence): Promise<void> {
    try {
      await handleVanityPresence(newPresence);
    } catch (error) {
      this.container.logger.warn(
        `[Vanity] Presence reconciliation failed for ${newPresence.userId}:`,
        error,
      );
    }
  }
}
