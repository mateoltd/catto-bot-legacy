import {
  MODERATION_DIRECT_SHORTCUTS,
  MODERATION_GROUP_SHORTCUTS,
  MODERATION_NAMESPACE,
} from './moderationPrefix.js';

export interface HelpCommandMetadata {
  readonly name: string;
  readonly description?: string;
  readonly fullCategory: readonly string[];
}

export interface HelpSubcommandMetadata {
  readonly name: string;
  readonly messageRun?: unknown;
  readonly entries?: readonly HelpSubcommandMetadata[];
}

export interface HelpLayoutSection {
  readonly name: string;
  readonly blocks: readonly string[];
}

export type HelpLayoutPage = [string, readonly string[]][];

export const HELP_FIELD_VALUE_LIMIT = 1_024;
export const HELP_EMBED_FIELD_LIMIT = 25;
// Leaves room below Discord's 6,000-character aggregate embed limit for the title, footer, etc.
export const HELP_EMBED_TEXT_BUDGET = 5_500;
export const HELP_READABLE_ENTRY_LIMIT = 10;

const CATEGORY_DETAILS = {
  general: { label: 'General', order: 0 },
  admin: { label: 'Administration', order: 1 },
  fun: { label: 'Fun', order: 2 },
  leveling: { label: 'Leveling', order: 3 },
  reputation: { label: 'Reputation', order: 4 },
  rewards: { label: 'Rewards', order: 5 },
  'temp-voice': { label: 'Temporary Voice', order: 6 },
  moderation: { label: 'Moderation', order: 7 },
} as const;

const HIDDEN_COMMANDS = new Set([
  // Internal diagnostics.
  'dbstats',
  'redis',

  // Special moderation flows that should not be advertised globally.
  'captcha',
  'quicksand',
  'ctrl-z',
  'missile-strike',
  'eject',
]);

const CONFIGURED_HELP_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  leaderboard: ['text', 'voice'],
  rank: ['text', 'voice'],
  voice: [
    'rename',
    'limit',
    'lock',
    'unlock',
    'hide',
    'show',
    'permit',
    'deny',
    'trust',
    'untrust',
    'kick',
    'transfer',
    'bitrate',
    'region',
    'reset',
    'claim',
    'panel',
    'setup',
  ],
};

const HELP_ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'fun.bonk': 'Bonk someone with a bat',
  'fun.superbonk': 'Use the owner-only ultimate bonk',

  'leaderboard.text': 'View the text XP leaderboard',
  'leaderboard.voice': 'View the voice XP leaderboard',
  'rank.text': 'View a text XP rank card',
  'rank.voice': 'View a voice XP rank card',

  'reputation.view': "View your or another user's reputation",
  'reputation.history': 'View received or given vouch history',
  'reputation.leaderboard': 'View the reputation leaderboard',
  'reputation.tiers': 'View reputation tiers and their perks',

  'permission.add': 'Grant or deny a permission for a role or user',
  'permission.remove': 'Remove a permission override',
  'permission.list': 'List permission overrides',

  'voice.rename': 'Rename your temporary voice channel',
  'voice.limit': 'Set the channel user limit',
  'voice.lock': 'Lock the channel to allowed users',
  'voice.unlock': 'Unlock the channel',
  'voice.hide': 'Hide the channel from everyone',
  'voice.show': 'Make the channel visible to everyone',
  'voice.permit': 'Allow a user to join the channel',
  'voice.deny': 'Deny a user access to the channel',
  'voice.trust': 'Let a user help manage the channel',
  'voice.untrust': "Remove a user's channel management access",
  'voice.kick': 'Kick a user from the channel',
  'voice.transfer': 'Transfer channel ownership',
  'voice.bitrate': 'Set the channel bitrate',
  'voice.region': 'Set the channel voice region',
  'voice.reset': 'Reset the channel to its defaults',
  'voice.claim': 'Claim an abandoned temporary channel',
  'voice.panel': 'Show the channel control panel',
  'voice.setup': 'Configure the temporary voice system',

  'mod.ban': 'Permanently ban a member or user ID',
  'mod.kick': 'Kick a member from the server',
  'mod.timeout': 'Temporarily restrict a member',
  'mod.warn': 'Issue a formal warning to a member',
  'mod.unban': 'Remove a server ban',
  'mod.case': 'View a moderation case',
  'mod.void': 'Void a moderation case',
  'mod.history': "View a member's moderation history",
  'mod.softban': 'Ban and immediately unban to purge messages',
  'mod.tempban': 'Ban a member for a set duration',
  'mod.panel': 'Open the interactive moderation panel',
  'mod.context': 'View recent moderation context for a member',
  'mod.mutes': 'List active moderation mutes',
  'mod.setup': 'Configure moderation roles and channels',
  'mod.voice where': 'Locate a member in voice',
  'mod.voice watch': "Watch a member's voice activity",
  'mod.voice snapshot': 'Snapshot a voice channel',
  'mod.voice track': 'Track voice channel activity',
  'mod.note add': 'Add a moderator note to a member',
  'mod.note list': 'List moderator notes for a member',
  'mod.note delete': 'Delete a moderator note',
  'mod.evidence add': 'Add evidence to a moderation case',
  'mod.evidence list': 'List evidence for a moderation case',
  'mod.mute text': 'Mute a member in text channels',
  'mod.mute voice': 'Mute a member in voice channels',
  'mod.mute both': 'Mute a member in text and voice channels',
  'mod.unmute text': "Remove a member's text mute",
  'mod.unmute voice': "Remove a member's voice mute",
  'mod.unmute both': 'Remove all active mutes from a member',
};

const HELP_ACTION_GROUP_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'mod.voice': 'Locate, watch, snapshot, or track voice activity',
  'mod.note': 'Add, list, or delete moderator notes',
  'mod.evidence': 'Add or list evidence for moderation cases',
  'mod.mute': 'Mute a member in text, voice, or both',
  'mod.unmute': 'Remove text, voice, or all active mutes',
};

export function getHelpCategory(command: HelpCommandMetadata): string {
  const rootCategory = command.fullCategory[0]?.toLowerCase() ?? 'general';
  return CATEGORY_DETAILS[rootCategory as keyof typeof CATEGORY_DETAILS]?.label ?? 'Other';
}

export function compareHelpCategories(left: string, right: string): number {
  const details = Object.values(CATEGORY_DETAILS);
  const leftOrder = details.find((category) => category.label === left)?.order ?? details.length;
  const rightOrder = details.find((category) => category.label === right)?.order ?? details.length;

  return leftOrder - rightOrder || left.localeCompare(right);
}

export function isCommandHiddenFromHelp(command: HelpCommandMetadata): boolean {
  const categoryPath = command.fullCategory.join('/').toLowerCase();
  return (
    categoryPath.startsWith('moderation/creative-bans') ||
    HIDDEN_COMMANDS.has(command.name.toLowerCase())
  );
}

export function getConfiguredHelpActions(commandName: string): readonly string[] {
  return CONFIGURED_HELP_ACTIONS[commandName.toLowerCase()] ?? [];
}

export function formatHelpCategoryHeading(category: string): string {
  return category;
}

export function isHelpCategoryAlias(command: HelpCommandMetadata): boolean {
  return command.fullCategory.join('/').toLowerCase() === 'moderation/aliases';
}

export function collectSubcommandHelpActions(
  subcommands: readonly HelpSubcommandMetadata[]
): string[] {
  const actions: string[] = [];

  for (const subcommand of subcommands) {
    if (subcommand.entries) {
      for (const entry of subcommand.entries) {
        if (entry.name !== 'help' && entry.messageRun) {
          actions.push(`${subcommand.name} ${entry.name}`);
        }
      }
    } else if (subcommand.name !== 'help' && subcommand.messageRun) {
      actions.push(subcommand.name);
    }
  }

  return actions;
}

export function formatHelpCommand(
  command: HelpCommandMetadata,
  actions: readonly string[] = []
): string {
  return formatHelpCommandBlocks(command, actions).join('\n');
}

export function getHelpActionDescription(commandName: string, action: string): string {
  return HELP_ACTION_DESCRIPTIONS[`${commandName}.${action}`] ?? `Run the ${action} action`;
}

export function getModerationActionShortcut(action: string): string | undefined {
  if (action in MODERATION_DIRECT_SHORTCUTS) return action;

  const [group, ...childPath] = action.split(' ');
  if (!group || childPath.length === 0) return undefined;

  const shortcut = MODERATION_GROUP_SHORTCUTS[group];
  return shortcut ? [shortcut, ...childPath].join(' ') : undefined;
}

export function getHelpActionPath(commandName: string, action: string): string {
  if (commandName === MODERATION_NAMESPACE) {
    return getModerationActionShortcut(action) ?? `${MODERATION_NAMESPACE} ${action}`;
  }

  return `${commandName} ${action}`;
}

export function formatHelpAction(commandName: string, action: string): string {
  const path = getHelpActionPath(commandName, action);
  const description = getHelpActionDescription(commandName, action);
  return `> \`${path}\`: ${description}`;
}

export function groupHelpActions(actions: readonly string[]): string[][] {
  const groups = new Map<string, string[]>();

  for (const action of actions) {
    const [root, ...childPath] = action.split(' ');
    const groupKey = root && childPath.length > 0 ? root : action;
    const existing = groups.get(groupKey);
    if (existing) existing.push(action);
    else groups.set(groupKey, [action]);
  }

  return [...groups.values()];
}

export function formatHelpActionGroup(commandName: string, actions: readonly string[]): string {
  const firstAction = actions[0];
  if (!firstAction) return '';
  if (actions.length === 1) return formatHelpAction(commandName, firstAction);

  const [root] = firstAction.split(' ');
  if (!root) return formatHelpAction(commandName, firstAction);

  const children = actions.map((action) => action.slice(root.length + 1));
  const shortcutRoot =
    commandName === MODERATION_NAMESPACE ? MODERATION_GROUP_SHORTCUTS[root] : undefined;
  const displayRoot = shortcutRoot ?? `${commandName} ${root}`;
  const path = `${displayRoot} <${children.join(' | ')}>`;
  const description =
    HELP_ACTION_GROUP_DESCRIPTIONS[`${commandName}.${root}`] ??
    actions.map((action) => getHelpActionDescription(commandName, action)).join('; ');

  return `> \`${path}\`: ${description}`;
}

export function formatHelpCommandBlocks(
  command: HelpCommandMetadata,
  actions: readonly string[] = []
): string[] {
  const actionBlocks = groupHelpActions(actions).map((group) =>
    formatHelpActionGroup(command.name, group)
  );

  if (command.name === MODERATION_NAMESPACE) return actionBlocks;

  return [`\`${command.name}\`: ${command.description ?? 'No description'}`, ...actionBlocks];
}

export function splitHelpCategory(
  category: string,
  blocks: readonly string[]
): HelpLayoutSection[] {
  const sections: HelpLayoutSection[] = [];
  let currentBlocks: string[] = [];
  let currentLength = 0;
  let sectionIndex = 0;

  for (const originalBlock of blocks) {
    const block =
      originalBlock.length <= HELP_FIELD_VALUE_LIMIT
        ? originalBlock
        : `${originalBlock.slice(0, HELP_FIELD_VALUE_LIMIT - 3)}...`;
    const separatorLength = currentBlocks.length > 0 ? 1 : 0;
    const fieldIsFull = currentLength + separatorLength + block.length > HELP_FIELD_VALUE_LIMIT;

    if (currentBlocks.length > 0 && fieldIsFull) {
      sections.push({
        name: sectionIndex === 0 ? category : `${category} (continued)`,
        blocks: currentBlocks,
      });
      currentBlocks = [];
      currentLength = 0;
      sectionIndex += 1;
    }

    currentBlocks.push(block);
    currentLength += (currentBlocks.length > 1 ? 1 : 0) + block.length;
  }

  if (currentBlocks.length > 0) {
    sections.push({
      name: sectionIndex === 0 ? category : `${category} (continued)`,
      blocks: currentBlocks,
    });
  }

  return sections;
}

function sectionTextLength(section: HelpLayoutSection): number {
  return section.name.length + section.blocks.join('\n').length;
}

function baseCategoryName(section: HelpLayoutSection): string {
  return section.name.replace(/ \(continued\)$/, '');
}

export function buildHelpPages(sections: readonly HelpLayoutSection[]): HelpLayoutPage[] {
  const categoryGroups: HelpLayoutSection[][] = [];

  for (const section of sections) {
    const currentGroup = categoryGroups.at(-1);
    const firstSection = currentGroup?.[0];
    if (
      currentGroup &&
      firstSection &&
      baseCategoryName(firstSection) === baseCategoryName(section)
    ) {
      currentGroup.push(section);
    } else {
      categoryGroups.push([section]);
    }
  }

  const pages: HelpLayoutPage[] = [];
  let currentPage: HelpLayoutPage = [];
  let currentLength = 0;
  let currentEntryCount = 0;

  const finishPage = () => {
    if (currentPage.length === 0) return;
    pages.push(currentPage);
    currentPage = [];
    currentLength = 0;
    currentEntryCount = 0;
  };

  const addSections = (group: readonly HelpLayoutSection[]) => {
    for (const section of group) {
      currentPage.push([section.name, section.blocks]);
      currentLength += sectionTextLength(section);
      currentEntryCount += section.blocks.length;
    }
  };

  for (const group of categoryGroups) {
    const groupLength = group.reduce((total, section) => total + sectionTextLength(section), 0);
    const groupEntryCount = group.reduce((total, section) => total + section.blocks.length, 0);
    const groupFitsHardLimits =
      group.length <= HELP_EMBED_FIELD_LIMIT && groupLength <= HELP_EMBED_TEXT_BUDGET;
    const groupFitsCurrentHardLimits =
      currentPage.length + group.length <= HELP_EMBED_FIELD_LIMIT &&
      currentLength + groupLength <= HELP_EMBED_TEXT_BUDGET;
    const groupFitsReadablePage = currentEntryCount + groupEntryCount <= HELP_READABLE_ENTRY_LIMIT;

    if (groupFitsHardLimits) {
      const categoryNeedsDedicatedPage = groupEntryCount > HELP_READABLE_ENTRY_LIMIT;
      if (
        currentPage.length > 0 &&
        (categoryNeedsDedicatedPage || !groupFitsReadablePage || !groupFitsCurrentHardLimits)
      ) {
        finishPage();
      }
      addSections(group);
      if (categoryNeedsDedicatedPage) finishPage();
      continue;
    }

    // A single unusually large category may span pages, but each field remains within limits.
    finishPage();
    for (const section of group) {
      const sectionLength = sectionTextLength(section);
      const sectionFitsCurrentPage =
        currentPage.length < HELP_EMBED_FIELD_LIMIT &&
        currentLength + sectionLength <= HELP_EMBED_TEXT_BUDGET;
      if (currentPage.length > 0 && !sectionFitsCurrentPage) finishPage();
      addSections([section]);
    }
  }

  finishPage();
  return pages;
}
