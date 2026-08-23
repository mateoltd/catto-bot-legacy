import { Command, container, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import { parseMuteFromMessage } from '#lib/interaction/messageArgs.js';
import { handleMuteText, handleMuteVoice, handleMuteBoth } from '../_mute.js';
import { runAliasCommand } from './_shared.js';
import type { CommandResponder } from '#lib/discord/index.js';
import type { MuteOptions } from '#lib/interaction/typedOptions.js';

const MUTE_TYPE_MAP: Record<
  string,
  (options: MuteOptions, ctx: CommandResponder) => Promise<void>
> = {
  text: handleMuteText,
  voice: handleMuteVoice,
  both: handleMuteBoth,
};

/**
 * `!mute [text|voice|both] <@user> [duration] <reason>`
 *
 * If the first argument is a mute type, it routes to the corresponding handler.
 * Otherwise defaults to "both".
 */
@ApplyOptions<Command.Options>({
  name: 'mute',
  aliases: ['m'],
  description: 'Mute a member in text, voice, or both channels',
  preconditions: ['GuildOnly'],
})
export class MuteAliasCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    let handler = handleMuteBoth;

    // Peek at the first arg — if it's a known mute type, consume it
    args.save();
    try {
      const word = (await args.pick('string')).toLowerCase();
      if (word in MUTE_TYPE_MAP) {
        handler = MUTE_TYPE_MAP[word]!;
      } else {
        args.restore();
      }
    } catch (err) {
      container.logger.debug('mute alias: no mute type arg provided, defaulting to both:', err);
      args.restore();
    }

    return runAliasCommand(message, args, parseMuteFromMessage, handler, true);
  }
}
