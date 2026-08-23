import { Listener, Events, type MessageCommandErrorPayload } from '@sapphire/framework';
import type { Logger } from '@sapphire/plugin-logger';
import { buildErrorEmbed } from '#lib/utils.js';

export class MessageCommandErrorListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageCommandError,
    });
  }

  public async run(error: Error, payload: MessageCommandErrorPayload) {
    const { command, message } = payload;
    const logger = this.container.logger as Logger;

    logger.error(
      `[Command Error] ${message.author.tag} (${message.author.id}) encountered an error while running message command "${command.name}"`
    );
    logger.error(error);

    const embed = buildErrorEmbed(
      'An error occurred while executing this command. Please try again later.',
      { title: 'Command Error' }
    );

    if (!message.channel.isSendable()) {
      return;
    }

    return message.channel.send({ embeds: [embed] });
  }
}
