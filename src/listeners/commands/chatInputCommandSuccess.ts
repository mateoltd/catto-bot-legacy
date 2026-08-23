import { Listener, Events, type ChatInputCommandSuccessPayload } from '@sapphire/framework';
import type { Logger } from '@sapphire/plugin-logger';

export class ChatInputCommandSuccessListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ChatInputCommandSuccess,
    });
  }

  public run(payload: ChatInputCommandSuccessPayload) {
    const { command, interaction } = payload;
    const logger = this.container.logger as Logger;

    logger.info(
      `[Command] ${interaction.user.tag} (${interaction.user.id}) successfully ran slash command "${command.name}" in ${interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'DMs'}`
    );
  }
}
