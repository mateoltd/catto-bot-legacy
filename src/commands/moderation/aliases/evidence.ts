import { Command, container, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import {
  parseEvidenceAddFromMessage,
  parseEvidenceListFromMessage,
} from '#lib/interaction/messageArgs.js';
import { handleEvidenceAdd } from '../_evidenceAdd.js';
import { handleEvidenceList } from '../_evidenceList.js';
import { runAliasCommand } from './_shared.js';

/**
 * `!evidence <add|list> <caseNumber>`
 *
 * Standalone shortcut for `!mod evidence <subcommand>`.
 */
@ApplyOptions<Command.Options>({
  name: 'evidence',
  aliases: ['ev'],
  description: 'Add or list evidence attached to moderation cases',
  preconditions: ['GuildOnly'],
})
export class EvidenceAliasCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    let subcommand: string;
    try {
      subcommand = (await args.pick('string')).toLowerCase();
    } catch (err) {
      container.logger.debug('evidence alias: no subcommand provided:', err);
      return this.sendUsage(message);
    }

    switch (subcommand) {
      case 'add':
      case 'a':
        return runAliasCommand(message, args, parseEvidenceAddFromMessage, handleEvidenceAdd);
      case 'list':
      case 'ls':
        return runAliasCommand(message, args, parseEvidenceListFromMessage, handleEvidenceList);
      default:
        return this.sendUsage(message);
    }
  }

  private sendUsage(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Evidence Commands**',
        `\`${prefix}ev add <caseNumber>\` — Add evidence to a case`,
        `\`${prefix}ev list <caseNumber>\` — List evidence for a case`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }
}
