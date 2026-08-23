import { Command, type Args } from '@sapphire/framework';
import type { StoreRegistry } from '@sapphire/pieces';
import type { Constructor } from '@sapphire/utilities';
import type { Message } from 'discord.js';
import { MessageResponder } from '#lib/discord/index.js';
import { runAliasCommand } from './_shared.js';

// Parsers
import {
  parseBanFromMessage,
  parseKickFromMessage,
  parseWarnFromMessage,
  parseTimeoutFromMessage,
  parseSoftbanFromMessage,
  parseTempbanFromMessage,
  parseUnbanFromMessage,
  parseCaseFromMessage,
  parseHistoryFromMessage,
  parseVoidFromMessage,
} from '#lib/interaction/messageArgs.js';

// Handlers
import { handleBan } from '../_ban.js';
import { handleKick } from '../_kick.js';
import { handleWarn } from '../_warn.js';
import { handleTimeout } from '../_timeout.js';
import { handleSoftban } from '../_softban.js';
import { handleTempban } from '../_tempban.js';
import { handleUnban } from '../_unban.js';
import { handleCase } from '../_case.js';
import { handleHistory } from '../_history.js';
import { handleCaseVoid } from '../_void.js';

interface AliasConfig {
  name: string;
  aliases?: string[];
  description: string;
  parser: (message: Message, args: Args) => Promise<unknown>;
  handler: (options: any, ctx: MessageResponder) => Promise<unknown>;
  createsCases?: boolean;
}

const SIMPLE_ALIASES: AliasConfig[] = [
  {
    name: 'ban',
    aliases: ['b'],
    description: 'Permanently ban a member or user ID from the server',
    parser: parseBanFromMessage,
    handler: handleBan,
    createsCases: true,
  },
  {
    name: 'kick',
    aliases: ['k'],
    description: 'Kick a member from the server',
    parser: parseKickFromMessage,
    handler: handleKick,
    createsCases: true,
  },
  {
    name: 'warn',
    aliases: ['w'],
    description: 'Issue a formal warning to a member',
    parser: parseWarnFromMessage,
    handler: handleWarn,
    createsCases: true,
  },
  {
    name: 'timeout',
    aliases: ['to'],
    description: 'Temporarily restrict a member from interacting',
    parser: parseTimeoutFromMessage,
    handler: handleTimeout,
    createsCases: true,
  },
  {
    name: 'softban',
    aliases: ['sb'],
    description: 'Ban and immediately unban to purge recent messages',
    parser: parseSoftbanFromMessage,
    handler: handleSoftban,
    createsCases: true,
  },
  {
    name: 'tempban',
    aliases: ['tb'],
    description: 'Temporarily ban a member for a set duration',
    parser: parseTempbanFromMessage,
    handler: handleTempban,
    createsCases: true,
  },
  {
    name: 'unban',
    aliases: ['ub'],
    description: 'Unban a user by their ID',
    parser: parseUnbanFromMessage,
    handler: handleUnban,
  },
  {
    name: 'case',
    aliases: ['c'],
    description: 'View details of a moderation case by number',
    parser: parseCaseFromMessage,
    handler: handleCase,
  },
  {
    name: 'history',
    aliases: ['hist'],
    description: "View a member's full moderation history",
    parser: parseHistoryFromMessage,
    handler: handleHistory,
  },
  {
    name: 'void',
    aliases: ['v'],
    description: 'Void a moderation case by number',
    parser: parseVoidFromMessage,
    handler: handleCaseVoid,
  },
];

function createAliasCommand(config: AliasConfig): Constructor<Command> {
  const { parser, handler, createsCases } = config;

  return class extends Command {
    public constructor(context: Command.LoaderContext) {
      super(context, {
        name: config.name,
        aliases: config.aliases ?? [],
        description: config.description,
        fullCategory: ['moderation', 'aliases'],
        preconditions: ['GuildOnly'],
      });
    }

    public override async messageRun(message: Message, args: Args) {
      return runAliasCommand(message, args, parser, handler, createsCases);
    }
  };
}

export function registerSimpleAliases(stores: StoreRegistry): void {
  const commandStore = stores.get('commands');
  for (const config of SIMPLE_ALIASES) {
    void commandStore.loadPiece({ name: config.name, piece: createAliasCommand(config) });
  }
}
