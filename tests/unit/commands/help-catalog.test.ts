import { describe, expect, it } from 'vitest';
import {
  buildHelpPages,
  compareHelpCategories,
  collectSubcommandHelpActions,
  formatHelpAction,
  formatHelpActionGroup,
  formatHelpCategoryHeading,
  formatHelpCommand,
  formatHelpCommandBlocks,
  getConfiguredHelpActions,
  getHelpActionDescription,
  getHelpActionPath,
  getHelpCategory,
  getModerationActionShortcut,
  groupHelpActions,
  isHelpCategoryAlias,
  isCommandHiddenFromHelp,
  HELP_EMBED_FIELD_LIMIT,
  HELP_EMBED_TEXT_BUDGET,
  HELP_FIELD_VALUE_LIMIT,
  splitHelpCategory,
} from '../../../src/lib/interaction/helpCatalog.js';

function command(name: string, ...fullCategory: string[]) {
  return { name, fullCategory };
}

describe('help catalog', () => {
  it.each([
    [command('ping', 'general'), 'General'],
    [command('fun', 'fun'), 'Fun'],
    [command('rank', 'leveling'), 'Leveling'],
    [command('rep', 'reputation'), 'Reputation'],
    [command('rewards', 'rewards'), 'Rewards'],
    [command('voice', 'temp-voice'), 'Temporary Voice'],
    [command('mod', 'moderation'), 'Moderation'],
    [command('evidence', 'moderation', 'aliases'), 'Moderation'],
    [command('permission', 'admin'), 'Administration'],
    [command('unknown', 'plugins'), 'Other'],
  ])('categorizes $name as %s', (metadata, expected) => {
    expect(getHelpCategory(metadata)).toBe(expected);
  });

  it('uses a stable display order for categories', () => {
    const categories = ['Other', 'Moderation', 'Fun', 'General', 'Administration'];

    expect(categories.sort(compareHelpCategories)).toEqual([
      'General',
      'Administration',
      'Fun',
      'Moderation',
      'Other',
    ]);
  });

  it.each(['dbstats', 'redis'])('hides the internal %s command', (name) => {
    expect(isCommandHiddenFromHelp(command(name, 'general'))).toBe(true);
  });

  it('keeps ordinary commands visible', () => {
    expect(isCommandHiddenFromHelp(command('ping', 'general'))).toBe(false);
  });

  it('continues hiding creative moderation commands', () => {
    expect(isCommandHiddenFromHelp(command('custom-name', 'moderation', 'creative-bans'))).toBe(
      true
    );
  });

  it('discovers prefix actions and nested action groups', () => {
    expect(
      collectSubcommandHelpActions([
        { name: 'help', messageRun: 'messageHelp' },
        { name: 'ban', messageRun: 'messageBan' },
        { name: 'slash-only' },
        {
          name: 'voice',
          entries: [
            { name: 'help', messageRun: 'messageVoiceHelp' },
            { name: 'where', messageRun: 'messageVoiceWhere' },
            { name: 'slash-only' },
          ],
        },
      ])
    ).toEqual(['ban', 'voice where']);
  });

  it.each([
    ['leaderboard', ['text', 'voice']],
    ['rank', ['text', 'voice']],
    [
      'voice',
      [
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
    ],
  ])('includes manually routed actions for %s', (name, actions) => {
    expect(getConfiguredHelpActions(name as string)).toEqual(actions);
  });

  it('uses colons and shows complete prefix action paths', () => {
    expect(formatHelpCommand(command('fun', 'fun'), ['bonk', 'superbonk'])).toBe(
      [
        '`fun`: No description',
        '> `fun bonk`: Bonk someone with a bat',
        '> `fun superbonk`: Use the owner-only ultimate bonk',
      ].join('\n')
    );
  });

  it('keeps command prefixes out of category titles', () => {
    expect(formatHelpCategoryHeading('Moderation')).toBe('Moderation');
    expect(formatHelpCategoryHeading('Moderation (continued)')).toBe('Moderation (continued)');
  });

  it.each([
    ['ban', 'ban'],
    ['panel', 'panel'],
    ['mutes', 'mutes'],
    ['voice where', 'mvc where'],
    ['note add', 'note add'],
    ['mute text', 'mute text'],
    ['context', undefined],
    ['setup', undefined],
  ])('resolves the moderation shortcut for %s', (action, shortcut) => {
    expect(getModerationActionShortcut(action)).toBe(shortcut);
  });

  it.each([
    ['mod', 'ban', 'ban'],
    ['mod', 'voice where', 'mvc where'],
    ['mod', 'context', 'mod context'],
    ['mod', 'setup', 'mod setup'],
    ['voice', 'rename', 'voice rename'],
  ])('chooses one canonical display path for %s %s', (commandName, action, path) => {
    expect(getHelpActionPath(commandName, action)).toBe(path);
  });

  it('shows one explained entry instead of duplicating a moderation shortcut', () => {
    expect(formatHelpAction('mod', 'ban')).toBe('> `ban`: Permanently ban a member or user ID');
    expect(formatHelpAction('mod', 'voice where')).toBe('> `mvc where`: Locate a member in voice');
  });

  it('provides explanations for configured actions', () => {
    expect(getHelpActionDescription('voice', 'transfer')).toBe('Transfer channel ownership');
    expect(getHelpActionDescription('permission', 'remove')).toBe('Remove a permission override');
  });

  it('groups nested sibling actions without combining unrelated commands', () => {
    expect(
      groupHelpActions(['ban', 'note add', 'note list', 'note delete', 'evidence add'])
    ).toEqual([['ban'], ['note add', 'note list', 'note delete'], ['evidence add']]);
    expect(formatHelpActionGroup('mod', ['note add', 'note list', 'note delete'])).toBe(
      '> `note <add | list | delete>`: Add, list, or delete moderator notes'
    );
  });

  it('compacts moderation groups into reproducible explained entries', () => {
    const blocks = formatHelpCommandBlocks(command('mod', 'moderation'), [
      'ban',
      'note add',
      'note list',
      'note delete',
      'mute text',
      'mute voice',
      'mute both',
    ]);

    expect(blocks).toEqual([
      '> `ban`: Permanently ban a member or user ID',
      '> `note <add | list | delete>`: Add, list, or delete moderator notes',
      '> `mute <text | voice | both>`: Mute a member in text, voice, or both',
    ]);
  });

  it('identifies standalone moderation aliases so the catalog can deduplicate them', () => {
    expect(isHelpCategoryAlias(command('ban', 'moderation', 'aliases'))).toBe(true);
    expect(isHelpCategoryAlias(command('mod', 'moderation'))).toBe(false);
  });

  it('packs small categories and gives large categories dedicated pages', () => {
    const category = (name: string, entries: number) =>
      splitHelpCategory(
        name,
        Array.from({ length: entries }, (_, index) => `> \`${name}-${index}\`: Description`)
      );
    const pages = buildHelpPages([
      ...category('General', 4),
      ...category('Administration', 4),
      ...category('Fun', 3),
      ...category('Leveling', 6),
      ...category('Reputation', 6),
      ...category('Rewards', 1),
      ...category('Temporary Voice', 19),
      ...category('Moderation', 19),
    ]);

    expect(pages.map((page) => page.map(([name]) => name))).toEqual([
      ['General', 'Administration'],
      ['Fun', 'Leveling'],
      ['Reputation', 'Rewards'],
      ['Temporary Voice'],
      ['Moderation'],
    ]);

    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(HELP_EMBED_FIELD_LIMIT);
      expect(
        page.reduce((length, [name, blocks]) => length + name.length + blocks.join('\n').length, 0)
      ).toBeLessThanOrEqual(HELP_EMBED_TEXT_BUDGET);
      for (const [, blocks] of page) {
        expect(blocks.join('\n').length).toBeLessThanOrEqual(HELP_FIELD_VALUE_LIMIT);
      }
    }
  });
});
