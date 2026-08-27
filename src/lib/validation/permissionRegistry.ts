import { PermissionFlagsBits, type PermissionResolvable } from 'discord.js';
import { MODERATION_DIRECT_SHORTCUTS } from '#lib/interaction/moderationPrefix.js';

export type ResourceType = 'COMMAND' | 'CATEGORY';

export interface ResourceResolution {
  type: ResourceType;
  key: string;
}

export interface CategoryDefinition {
  key: string;
  displayName: string;
  description: string;
  parentCategory?: string;
}

export interface CommandDefinition {
  key: string;
  displayName: string;
  categories: string[];
  fallbackDiscordPermission?: PermissionResolvable;
}

const CATEGORIES: Record<string, CategoryDefinition> = {
  moderation: {
    key: 'moderation',
    displayName: 'Moderation',
    description: 'All moderation commands',
  },
  'moderation.punitive': {
    key: 'moderation.punitive',
    displayName: 'Punitive Actions',
    description: 'Punishment commands (warn, kick, ban, etc.)',
    parentCategory: 'moderation',
  },
  'moderation.info': {
    key: 'moderation.info',
    displayName: 'Moderation Info',
    description: 'Viewing cases, history, notes',
    parentCategory: 'moderation',
  },
  'moderation.voice': {
    key: 'moderation.voice',
    displayName: 'Voice Moderation',
    description: 'Voice channel moderation commands',
    parentCategory: 'moderation',
  },
  'moderation.evidence': {
    key: 'moderation.evidence',
    displayName: 'Evidence Management',
    description: 'Evidence upload, viewing, and management',
    parentCategory: 'moderation',
  },
  admin: {
    key: 'admin',
    displayName: 'Administration',
    description: 'Administrative commands',
  },
  utility: {
    key: 'utility',
    displayName: 'Utility',
    description: 'Utility commands',
  },
};

const COMMANDS: Record<string, CommandDefinition> = {
  'mod.warn': {
    key: 'mod.warn',
    displayName: 'Warn',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.kick': {
    key: 'mod.kick',
    displayName: 'Kick',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.KickMembers,
  },
  'mod.ban': {
    key: 'mod.ban',
    displayName: 'Ban',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.BanMembers,
  },
  'mod.unban': {
    key: 'mod.unban',
    displayName: 'Unban',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.BanMembers,
  },
  'mod.timeout': {
    key: 'mod.timeout',
    displayName: 'Timeout',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.softban': {
    key: 'mod.softban',
    displayName: 'Softban',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.BanMembers,
  },
  'mod.tempban': {
    key: 'mod.tempban',
    displayName: 'Tempban',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.BanMembers,
  },
  'mod.mute.text': {
    key: 'mod.mute.text',
    displayName: 'Mute (Text)',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.mute.voice': {
    key: 'mod.mute.voice',
    displayName: 'Mute (Voice)',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.MuteMembers,
  },
  'mod.mute.both': {
    key: 'mod.mute.both',
    displayName: 'Mute (Both)',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.unmute.text': {
    key: 'mod.unmute.text',
    displayName: 'Unmute (Text)',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.unmute.voice': {
    key: 'mod.unmute.voice',
    displayName: 'Unmute (Voice)',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.MuteMembers,
  },
  'mod.unmute.both': {
    key: 'mod.unmute.both',
    displayName: 'Unmute (Both)',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.case': {
    key: 'mod.case',
    displayName: 'View Case',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.history': {
    key: 'mod.history',
    displayName: 'View History',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.void': {
    key: 'mod.void',
    displayName: 'Void Case',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.panel': {
    key: 'mod.panel',
    displayName: 'Mod Panel',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.context': {
    key: 'mod.context',
    displayName: 'View Context',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.mutes': {
    key: 'mod.mutes',
    displayName: 'List Mutes',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.note.add': {
    key: 'mod.note.add',
    displayName: 'Add Note',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.note.list': {
    key: 'mod.note.list',
    displayName: 'List Notes',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.note.delete': {
    key: 'mod.note.delete',
    displayName: 'Delete Note',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.casemod.edit': {
    key: 'mod.casemod.edit',
    displayName: 'Edit Case',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.casemod.link': {
    key: 'mod.casemod.link',
    displayName: 'Link Case',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.casemod.close': {
    key: 'mod.casemod.close',
    displayName: 'Close Case',
    categories: ['moderation', 'moderation.info'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.voice.where': {
    key: 'mod.voice.where',
    displayName: 'Voice Where',
    categories: ['moderation', 'moderation.voice'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.voice.watch': {
    key: 'mod.voice.watch',
    displayName: 'Voice Watch',
    categories: ['moderation', 'moderation.voice'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.voice.snapshot': {
    key: 'mod.voice.snapshot',
    displayName: 'Voice Snapshot',
    categories: ['moderation', 'moderation.voice'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.voice.track': {
    key: 'mod.voice.track',
    displayName: 'Voice Track',
    categories: ['moderation', 'moderation.voice'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.evidence.add': {
    key: 'mod.evidence.add',
    displayName: 'Add Evidence',
    categories: ['moderation', 'moderation.evidence'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.evidence.list': {
    key: 'mod.evidence.list',
    displayName: 'List Evidence',
    categories: ['moderation', 'moderation.evidence'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.evidence.view': {
    key: 'mod.evidence.view',
    displayName: 'View Evidence',
    categories: ['moderation', 'moderation.evidence'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.evidence.capture': {
    key: 'mod.evidence.capture',
    displayName: 'Capture Evidence',
    categories: ['moderation', 'moderation.evidence'],
    fallbackDiscordPermission: PermissionFlagsBits.ModerateMembers,
  },
  'mod.setup': {
    key: 'mod.setup',
    displayName: 'Mod Setup',
    categories: ['moderation', 'admin'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'mod.creative.captcha': {
    key: 'mod.creative.captcha',
    displayName: 'Creative Ban: Captcha',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'mod.creative.quicksand': {
    key: 'mod.creative.quicksand',
    displayName: 'Creative Ban: Quicksand',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'mod.creative.ctrl-z': {
    key: 'mod.creative.ctrl-z',
    displayName: 'Creative Ban: Ctrl-Z',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'mod.creative.missile-strike': {
    key: 'mod.creative.missile-strike',
    displayName: 'Creative Ban: Missile Strike',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'mod.creative.eject': {
    key: 'mod.creative.eject',
    displayName: 'Creative Ban: Eject',
    categories: ['moderation', 'moderation.punitive'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'permission.add': {
    key: 'permission.add',
    displayName: 'Add Permission',
    categories: ['admin'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'permission.remove': {
    key: 'permission.remove',
    displayName: 'Remove Permission',
    categories: ['admin'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'permission.list': {
    key: 'permission.list',
    displayName: 'List Permissions',
    categories: ['admin'],
    fallbackDiscordPermission: PermissionFlagsBits.Administrator,
  },
  'general.language': {
    key: 'general.language',
    displayName: 'Language',
    categories: ['admin'],
    fallbackDiscordPermission: PermissionFlagsBits.ManageGuild,
  },
};

const COMMAND_SHORTCUTS: Record<string, string> = {
  ...MODERATION_DIRECT_SHORTCUTS,
  mute: 'mod.mute.both',
  unmute: 'mod.unmute.both',
  context: 'mod.context',
  note: 'mod.note.add',
  evidence: 'mod.evidence.add',
  capture: 'mod.evidence.capture',
  setup: 'mod.setup',
  captcha: 'mod.creative.captcha',
  quicksand: 'mod.creative.quicksand',
  'ctrl-z': 'mod.creative.ctrl-z',
  'missile-strike': 'mod.creative.missile-strike',
  eject: 'mod.creative.eject',
};

export function allCategories(): CategoryDefinition[] {
  return Object.values(CATEGORIES);
}

export function allCategoryKeys(): string[] {
  return Object.keys(CATEGORIES);
}

export function allCommands(): CommandDefinition[] {
  return Object.values(COMMANDS);
}

export function allCommandKeys(): string[] {
  return Object.keys(COMMANDS);
}

export function getCategory(key: string): CategoryDefinition | undefined {
  return CATEGORIES[key];
}

export function getCommand(key: string): CommandDefinition | undefined {
  return COMMANDS[key];
}

export function categoriesForCommand(commandKey: string): string[] {
  const command = COMMANDS[commandKey];
  if (!command) return [];
  return command.categories;
}

export function commandsInCategory(categoryKey: string): CommandDefinition[] {
  return Object.values(COMMANDS).filter((cmd) => cmd.categories.includes(categoryKey));
}

export function fallbackDiscordPermissionForCommand(
  commandKey: string
): PermissionResolvable | undefined {
  const command = COMMANDS[commandKey];
  return command?.fallbackDiscordPermission;
}

export function resolveResourceInput(input: string): ResourceResolution | null {
  const normalized = input.toLowerCase().trim();

  if (CATEGORIES[normalized]) {
    return { type: 'CATEGORY', key: normalized };
  }

  if (COMMANDS[normalized]) {
    return { type: 'COMMAND', key: normalized };
  }

  const shortcut = COMMAND_SHORTCUTS[normalized];
  if (shortcut && COMMANDS[shortcut]) {
    return { type: 'COMMAND', key: shortcut };
  }

  const matchingCommands = Object.keys(COMMANDS).filter(
    (key) => key.endsWith(`.${normalized}`) || key === normalized
  );

  if (matchingCommands.length === 1 && matchingCommands[0]) {
    return { type: 'COMMAND', key: matchingCommands[0] };
  }

  return null;
}

export function buildCommandKeyFromInteraction(
  commandName: string,
  subcommandGroup: string | null,
  subcommand: string | null
): string {
  const parts = [commandName];
  if (subcommandGroup) parts.push(subcommandGroup);
  if (subcommand) parts.push(subcommand);
  return parts.join('.');
}

export function getRegistryForDashboard(): {
  categories: CategoryDefinition[];
  commands: CommandDefinition[];
} {
  return {
    categories: allCategories(),
    commands: allCommands(),
  };
}
