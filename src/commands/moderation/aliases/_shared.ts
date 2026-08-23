import type { Args } from '@sapphire/framework';
import { UserError, container } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { MessageResponder } from '#lib/discord/index.js';
import { buildErrorText } from '#lib/discord/index.js';

const WELCOME_MESSAGE = [
  '**Welcome to the moderation team!** Here are some tips to get started:',
  '',
  '**Punitive:** `!ban` (`!b`), `!kick` (`!k`), `!warn` (`!w`), `!timeout` (`!to`), `!mute` (`!m`), `!softban` (`!sb`), `!tempban` (`!tb`)',
  '**Info:** `!history @user` (`!hist`), `!case <#>` (`!c`), `!mod panel @user`, `!mod context @user`',
  '**Notes:** `!note add @user <text>`, `!note list @user`',
  '**Voice:** `!mvc where @user`, `!mvc snapshot #channel`',
  '',
  'Use `!help` to see all available commands.',
].join('\n');

/**
 * Send a welcome message to first-time moderators
 * Checks if the moderator has exactly 1 case (the one just created)
 * Uses an indexed count query — lightweight, no in-memory state
 */
export async function sendModWelcome(message: Message): Promise<void> {
  try {
    const count = await container.prisma.modCase.count({
      where: { guildId: message.guild!.id, moderatorId: message.author.id },
    });
    if (count !== 1) return; // Only welcome on their very first case

    if (message.channel.isSendable()) {
      await message.channel.send({
        content: WELCOME_MESSAGE,
        allowedMentions: { parse: [] },
      });
    }
  } catch (err) {
    container.logger.warn('sendModWelcome: failed to check/send welcome message:', err);
  }
}

/**
 * Shared helper for prefix alias commands.
 * Wraps parser + handler with error handling identical to handleMessageCommand
 */
export async function runAliasCommand<T>(
  message: Message,
  args: Args,
  parser: (message: Message, args: Args) => Promise<T>,
  handler: (options: T, ctx: MessageResponder) => Promise<unknown>,
  createsCases = false
): Promise<unknown> {
  try {
    const options = await parser(message, args);
    const result = await handler(options, new MessageResponder(message as Message<true>));
    if (createsCases) sendModWelcome(message);
    return result;
  } catch (error) {
    if (error instanceof UserError) {
      if (message.channel.isSendable()) {
        return message.channel.send({
          content: buildErrorText(error.message),
          allowedMentions: { parse: [] },
        });
      }
    }
    throw error;
  }
}
