import {
  Listener,
  Events,
  type MessageCommandDeniedPayload,
  type UserError,
} from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Prisma } from '@prisma/client';
import type { FluentContainer } from '#lib/discord/containers/index.js';
import { errorMessage } from '#lib/discord/containers/index.js';
import { MessageFlags } from 'discord.js';

/**
 * Handles denied message commands.
 *
 * When a precondition (like PermissionGatePrecondition using Gate) denies a command:
 * 1. Logs the denial to the database
 * 2. Sends an error response in the channel (message commands can't be ephemeral)
 */
@ApplyOptions<Listener.Options>({
  event: Events.MessageCommandDenied,
})
export class MessageCommandDeniedListener extends Listener<typeof Events.MessageCommandDenied> {
  public override async run(error: UserError, { message, command }: MessageCommandDeniedPayload) {
    const isSilent = Reflect.get(Object(error.context), 'silent') === true;

    // Log the denial (non-blocking)
    this.container.prisma.log
      .create({
        data: {
          level: 'warn',
          message: `Message command denied: ${command.name}`,
          metadata: {
            userId: message.author.id,
            username: message.author.username,
            guildId: message.guildId,
            commandName: command.name,
            identifier: error.identifier,
            code: Reflect.get(Object(error.context), 'code'),
          } satisfies Prisma.InputJsonObject,
        },
      })
      .catch((err: unknown) =>
        this.container.logger.error('Failed to log message command denial:', err)
      );

    if (isSilent) return;

    // Use the DCB container from Gate if available, otherwise build a fallback
    const response: FluentContainer =
      Reflect.get(Object(error.context), 'response') ?? errorMessage('Error', error.message);

    if (!message.channel.isSendable()) return;

    try {
      await message.channel.send({
        components: [response.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch {
      // Channel may not be accessible
    }
  }
}
