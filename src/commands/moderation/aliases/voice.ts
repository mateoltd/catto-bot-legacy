import { Command, container, type Args } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';
import {
  parseVoiceWhereFromMessage,
  parseVoiceWatchFromMessage,
  parseVoiceSnapshotFromMessage,
  parseVoiceTrackFromMessage,
} from '#lib/interaction/messageArgs.js';
import { handleVoiceWhere } from '../_voiceWhere.js';
import { handleVoiceWatch } from '../_voiceWatch.js';
import { handleVoiceSnapshot } from '../_voiceSnapshot.js';
import { handleVoiceTrack } from '../_voiceTrack.js';
import { runAliasCommand } from './_shared.js';

/**
 * `!voice <where|watch|snapshot|track> ...args`
 *
 * Standalone shortcut for `!mod voice <subcommand>`.
 */
@ApplyOptions<Command.Options>({
  name: 'mvc',
  aliases: [],
  description: 'Monitor and snapshot voice channel activity',
  preconditions: ['GuildOnly'],
})
export class VoiceAliasCommand extends Command {
  public override async messageRun(message: Message, args: Args) {
    let subcommand: string;
    try {
      subcommand = (await args.pick('string')).toLowerCase();
    } catch (err) {
      container.logger.debug('voice alias: no subcommand provided:', err);
      return this.sendUsage(message);
    }

    switch (subcommand) {
      case 'where':
      case 'w':
        return runAliasCommand(message, args, parseVoiceWhereFromMessage, handleVoiceWhere);
      case 'watch':
        return runAliasCommand(message, args, parseVoiceWatchFromMessage, handleVoiceWatch);
      case 'snapshot':
      case 'snap':
      case 'ss':
        return runAliasCommand(message, args, parseVoiceSnapshotFromMessage, handleVoiceSnapshot);
      case 'track':
        return runAliasCommand(message, args, parseVoiceTrackFromMessage, handleVoiceTrack);
      default:
        return this.sendUsage(message);
    }
  }

  private sendUsage(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Voice Commands**',
        `\`${prefix}mvc where <user>\` — Locate user in voice`,
        `\`${prefix}mvc watch <user> <duration>\` — Watch voice activity`,
        `\`${prefix}mvc snapshot <channel>\` — Snapshot voice channel`,
        `\`${prefix}mvc track <channel> <duration>\` — Track voice channel`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }
}
