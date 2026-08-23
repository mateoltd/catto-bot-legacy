import { Command, container, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import {
  parseNoteAddFromMessage,
  parseNoteListFromMessage,
  parseNoteDeleteFromMessage,
} from '#lib/interaction/messageArgs.js';
import { handleNoteAdd, handleNoteList, handleNoteDelete } from '../_note.js';
import { runAliasCommand } from './_shared.js';

/**
 * `!note <add|list|delete> ...args`
 *
 * Standalone shortcut for `!mod note <subcommand>`.
 */
@ApplyOptions<Command.Options>({
  name: 'note',
  aliases: ['notes', 'n'],
  description: 'Add, list, or delete moderator notes on members',
  preconditions: ['GuildOnly'],
})
export class NoteAliasCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    let subcommand: string;
    try {
      subcommand = (await args.pick('string')).toLowerCase();
    } catch (err) {
      container.logger.debug('note alias: no subcommand provided:', err);
      return this.sendUsage(message);
    }

    switch (subcommand) {
      case 'add':
      case 'a':
        return runAliasCommand(message, args, parseNoteAddFromMessage, handleNoteAdd);
      case 'list':
      case 'ls':
        return runAliasCommand(message, args, parseNoteListFromMessage, handleNoteList);
      case 'delete':
      case 'del':
      case 'rm':
        return runAliasCommand(message, args, parseNoteDeleteFromMessage, handleNoteDelete);
      default:
        return this.sendUsage(message);
    }
  }

  private sendUsage(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Note Commands**',
        `\`${prefix}note add <user> <text> [tags]\` — Add a note`,
        `\`${prefix}note list <user>\` — List notes for a user`,
        `\`${prefix}note del <noteId>\` — Delete a note`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }
}
