import { Events, Listener } from '@sapphire/framework';
import type { Guild } from 'discord.js';
import { reconcileGuildVanity } from '#modules/vanity/runtime.service.js';

export class VanityGuildAvailableListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildAvailable });
  }

  public async run(guild: Guild): Promise<void> {
    try {
      await reconcileGuildVanity(guild);
    } catch (error) {
      this.container.logger.warn(`[Vanity] Guild reconciliation failed for ${guild.id}:`, error);
    }
  }
}
