import { Precondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

export class DMOnlyPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, {
      ...options,
      name: 'DMOnly',
    });
  }

  public override async messageRun(message: Message) {
    return !message.guild
      ? this.ok()
      : this.error({ message: 'This command can only be used in direct messages.' });
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    return !interaction.guild
      ? this.ok()
      : this.error({ message: 'This command can only be used in direct messages.' });
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return !interaction.guild
      ? this.ok()
      : this.error({ message: 'This command can only be used in direct messages.' });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    DMOnly: never;
  }
}
