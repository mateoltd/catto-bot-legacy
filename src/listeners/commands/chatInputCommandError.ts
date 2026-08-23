import { Listener, Events, type ChatInputCommandErrorPayload } from '@sapphire/framework';
import type { Logger } from '@sapphire/plugin-logger';
import { MessageFlags } from 'discord.js';

export class ChatInputCommandErrorListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ChatInputCommandError,
    });
  }

  public run(error: Error, payload: ChatInputCommandErrorPayload) {
    const { command, interaction } = payload;
    const logger = this.container.logger as Logger;

    logger.error(
      `[Command Error] ${interaction.user.tag} (${interaction.user.id}) encountered an error while running slash command "${command.name}"`
    );
    logger.error(error);

    return interaction.reply({
      content: '❌ An error occurred while executing this command.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
