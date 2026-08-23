import { Listener, Events, type MessageCommandSuccessPayload } from '@sapphire/framework';
import type { Logger } from '@sapphire/plugin-logger';

export class MessageCommandSuccessListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageCommandSuccess,
    });
  }

  public run(payload: MessageCommandSuccessPayload) {
    const { command, message } = payload;
    const logger = this.container.logger as Logger;

    logger.info(
      `[Command] ${message.author.tag} (${message.author.id}) successfully ran message command "${command.name}" in ${message.guild ? `${message.guild.name} (${message.guild.id})` : 'DMs'}`
    );
  }
}
