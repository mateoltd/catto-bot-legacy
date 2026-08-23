import {
  Listener,
  Events,
  type ContextMenuCommandDeniedPayload,
  type UserError,
} from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Prisma } from '@prisma/client';
import type { FluentContainer } from '#lib/discord/containers/index.js';
import { errorMessage } from '#lib/discord/containers/index.js';
import { reply, editReply } from '#lib/discord/core/reply.js';

/**
 * Handles denied context menu commands.
 *
 * When a precondition (like PermissionGatePrecondition using Gate) denies a context menu command:
 * 1. Logs the denial to the database
 * 2. Sends an ephemeral error response to the user
 */
@ApplyOptions<Listener.Options>({
  event: Events.ContextMenuCommandDenied,
})
export class ContextMenuCommandDeniedListener extends Listener<
  typeof Events.ContextMenuCommandDenied
> {
  public override async run(
    error: UserError,
    { interaction, command }: ContextMenuCommandDeniedPayload
  ) {
    // Check if this denial should be silent
    const isSilent = Reflect.get(Object(error.context), 'silent') === true;

    // Log the denial (non-blocking)
    this.container.prisma.log
      .create({
        data: {
          level: 'warn',
          message: `Context menu denied: ${command.name}`,
          metadata: {
            userId: interaction.user.id,
            username: interaction.user.username,
            guildId: interaction.guildId,
            commandName: command.name,
            identifier: error.identifier,
            code: Reflect.get(Object(error.context), 'code'),
          } satisfies Prisma.InputJsonObject,
        },
      })
      .catch((err) => this.container.logger.error('Failed to log context menu denial:', err));

    // Don't respond if silent
    if (isSilent) return;

    // Use DCB container from Gate if available, otherwise create a fallback
    const response: FluentContainer =
      Reflect.get(Object(error.context), 'response') ?? errorMessage('Error', error.message);

    try {
      if (interaction.deferred || interaction.replied) {
        await editReply(interaction, response);
      } else {
        await reply(interaction, response);
      }
    } catch {
      // Interaction may have expired
    }
  }
}
