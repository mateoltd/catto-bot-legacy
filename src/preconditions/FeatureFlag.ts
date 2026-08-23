import { Precondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';
import { isFeatureEnabled } from '#lib/features/featureFlags.js';

/**
 * Precondition that checks if a feature flag is enabled for the current guild.
 *
 * Note: Creative ban commands perform the feature flag check directly
 * in their shared runner for simplicity. This precondition is available for
 * future commands that need declarative feature flag gating.
 */
export class FeatureFlagPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, {
      ...options,
      name: 'FeatureFlag',
    });
  }

  public override async messageRun(message: Message) {
    return this.checkFlag(message.guildId);
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    return this.checkFlag(interaction.guildId);
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return this.checkFlag(interaction.guildId);
  }

  private checkFlag(guildId: string | null) {
    if (!guildId) {
      return this.error({ message: 'This command can only be used in a server.' });
    }

    // Check the 'creative-bans' feature flag
    // This precondition is a blanket check for all commands that use it
    if (!isFeatureEnabled('creative-bans', guildId)) {
      return this.error({ message: 'This feature is not available in this server.' });
    }

    return this.ok();
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    FeatureFlag: never;
  }
}
