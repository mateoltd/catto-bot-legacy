/**
 * Select Menu Builders
 *
 * Fluent API for building Discord select menus (dropdowns).
 * Supports all select menu types: String, Channel, Role, User, Mentionable.
 */

import {
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ActionRowBuilder,
  ChannelType,
} from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';

// Types

/**
 * Option for string select menus
 */
export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

/**
 * Common select menu configuration
 */
export interface SelectMenuConfig {
  customId: string;
  placeholder?: string;
  disabled?: boolean;
  minValues?: number;
  maxValues?: number;
}

/**
 * String select menu configuration
 */
export interface StringSelectConfig extends SelectMenuConfig {
  options: SelectOption[];
}

/**
 * Channel select menu configuration
 */
export interface ChannelSelectConfig extends SelectMenuConfig {
  channelTypes?: ChannelType[];
  defaultChannels?: string[];
}

/**
 * Role select menu configuration
 */
export interface RoleSelectConfig extends SelectMenuConfig {
  defaultRoles?: string[];
}

/**
 * User select menu configuration
 */
export interface UserSelectConfig extends SelectMenuConfig {
  defaultUsers?: string[];
}

/**
 * Mentionable select menu configuration
 */
export interface MentionableSelectConfig extends SelectMenuConfig {
  defaultMentionables?: string[];
}

// String Select Menu Builders

/**
 * Create a string select menu
 */
export function stringSelect(config: StringSelectConfig): StringSelectMenuBuilder {
  const menu = new StringSelectMenuBuilder().setCustomId(config.customId).addOptions(
    config.options.map((opt) => ({
      label: opt.label,
      value: opt.value,
      description: opt.description,
      emoji: opt.emoji,
      default: opt.default,
    }))
  );

  if (config.placeholder) {
    menu.setPlaceholder(config.placeholder);
  }

  if (config.disabled) {
    menu.setDisabled(true);
  }

  if (config.minValues !== undefined) {
    menu.setMinValues(config.minValues);
  }

  if (config.maxValues !== undefined) {
    menu.setMaxValues(config.maxValues);
  }

  return menu;
}

/**
 * Create a string select menu row
 */
export function stringSelectRow(
  config: StringSelectConfig
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(stringSelect(config));
}

/**
 * Create a yes/no select menu
 */
export function yesNoSelect(
  customId: string,
  options?: {
    placeholder?: string;
    yesLabel?: string;
    noLabel?: string;
    yesDescription?: string;
    noDescription?: string;
    defaultValue?: 'yes' | 'no';
  }
): StringSelectMenuBuilder {
  return stringSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select an option',
    options: [
      {
        label: options?.yesLabel ?? 'Yes',
        value: 'yes',
        description: options?.yesDescription,
        emoji: EMOJI.STATUS.SUCCESS,
        default: options?.defaultValue === 'yes',
      },
      {
        label: options?.noLabel ?? 'No',
        value: 'no',
        description: options?.noDescription,
        emoji: EMOJI.STATUS.ERROR,
        default: options?.defaultValue === 'no',
      },
    ],
  });
}

/**
 * Create a pagination select menu
 */
export function pageSelect(
  customId: string,
  totalPages: number,
  currentPage: number = 1,
  options?: {
    placeholder?: string;
  }
): StringSelectMenuBuilder {
  const pageOptions: SelectOption[] = [];
  for (let i = 1; i <= Math.min(totalPages, 25); i++) {
    pageOptions.push({
      label: `Page ${i}`,
      value: i.toString(),
      default: i === currentPage,
    });
  }

  return stringSelect({
    customId,
    placeholder: options?.placeholder ?? 'Jump to page',
    options: pageOptions,
  });
}

// Channel Select Menu Builders

/**
 * Create a channel select menu
 */
export function channelSelect(config: ChannelSelectConfig): ChannelSelectMenuBuilder {
  const menu = new ChannelSelectMenuBuilder().setCustomId(config.customId);

  if (config.placeholder) {
    menu.setPlaceholder(config.placeholder);
  }

  if (config.channelTypes && config.channelTypes.length > 0) {
    menu.setChannelTypes(config.channelTypes);
  }

  if (config.disabled) {
    menu.setDisabled(true);
  }

  if (config.minValues !== undefined) {
    menu.setMinValues(config.minValues);
  }

  if (config.maxValues !== undefined) {
    menu.setMaxValues(config.maxValues);
  }

  if (config.defaultChannels && config.defaultChannels.length > 0) {
    menu.setDefaultChannels(config.defaultChannels);
  }

  return menu;
}

/**
 * Create a channel select menu row
 */
export function channelSelectRow(
  config: ChannelSelectConfig
): ActionRowBuilder<ChannelSelectMenuBuilder> {
  return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect(config));
}

/**
 * Create a text channel select menu
 */
export function textChannelSelect(
  customId: string,
  options?: {
    placeholder?: string;
    maxValues?: number;
  }
): ChannelSelectMenuBuilder {
  return channelSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select a text channel',
    channelTypes: [ChannelType.GuildText],
    maxValues: options?.maxValues,
  });
}

/**
 * Create a voice channel select menu
 */
export function voiceChannelSelect(
  customId: string,
  options?: {
    placeholder?: string;
    maxValues?: number;
  }
): ChannelSelectMenuBuilder {
  return channelSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select a voice channel',
    channelTypes: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
    maxValues: options?.maxValues,
  });
}

/**
 * Create a category channel select menu
 */
export function categorySelect(
  customId: string,
  options?: {
    placeholder?: string;
    maxValues?: number;
  }
): ChannelSelectMenuBuilder {
  return channelSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select a category',
    channelTypes: [ChannelType.GuildCategory],
    maxValues: options?.maxValues,
  });
}

// Role Select Menu Builders

/**
 * Create a role select menu
 */
export function roleSelect(config: RoleSelectConfig): RoleSelectMenuBuilder {
  const menu = new RoleSelectMenuBuilder().setCustomId(config.customId);

  if (config.placeholder) {
    menu.setPlaceholder(config.placeholder);
  }

  if (config.disabled) {
    menu.setDisabled(true);
  }

  if (config.minValues !== undefined) {
    menu.setMinValues(config.minValues);
  }

  if (config.maxValues !== undefined) {
    menu.setMaxValues(config.maxValues);
  }

  if (config.defaultRoles && config.defaultRoles.length > 0) {
    menu.setDefaultRoles(config.defaultRoles);
  }

  return menu;
}

/**
 * Create a role select menu row
 */
export function roleSelectRow(config: RoleSelectConfig): ActionRowBuilder<RoleSelectMenuBuilder> {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect(config));
}

/**
 * Create a single role select menu
 */
export function singleRoleSelect(
  customId: string,
  options?: {
    placeholder?: string;
    defaultRole?: string;
  }
): RoleSelectMenuBuilder {
  return roleSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select a role',
    maxValues: 1,
    defaultRoles: options?.defaultRole ? [options.defaultRole] : undefined,
  });
}

/**
 * Create a multi-role select menu
 */
export function multiRoleSelect(
  customId: string,
  options?: {
    placeholder?: string;
    minValues?: number;
    maxValues?: number;
    defaultRoles?: string[];
  }
): RoleSelectMenuBuilder {
  return roleSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select roles',
    minValues: options?.minValues ?? 1,
    maxValues: options?.maxValues ?? 25,
    defaultRoles: options?.defaultRoles,
  });
}

// User Select Menu Builders

/**
 * Create a user select menu
 */
export function userSelect(config: UserSelectConfig): UserSelectMenuBuilder {
  const menu = new UserSelectMenuBuilder().setCustomId(config.customId);

  if (config.placeholder) {
    menu.setPlaceholder(config.placeholder);
  }

  if (config.disabled) {
    menu.setDisabled(true);
  }

  if (config.minValues !== undefined) {
    menu.setMinValues(config.minValues);
  }

  if (config.maxValues !== undefined) {
    menu.setMaxValues(config.maxValues);
  }

  if (config.defaultUsers && config.defaultUsers.length > 0) {
    menu.setDefaultUsers(config.defaultUsers);
  }

  return menu;
}

/**
 * Create a user select menu row
 */
export function userSelectRow(config: UserSelectConfig): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect(config));
}

/**
 * Create a single user select menu
 */
export function singleUserSelect(
  customId: string,
  options?: {
    placeholder?: string;
    defaultUser?: string;
  }
): UserSelectMenuBuilder {
  return userSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select a user',
    maxValues: 1,
    defaultUsers: options?.defaultUser ? [options.defaultUser] : undefined,
  });
}

/**
 * Create a multi-user select menu
 */
export function multiUserSelect(
  customId: string,
  options?: {
    placeholder?: string;
    minValues?: number;
    maxValues?: number;
    defaultUsers?: string[];
  }
): UserSelectMenuBuilder {
  return userSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select users',
    minValues: options?.minValues ?? 1,
    maxValues: options?.maxValues ?? 25,
    defaultUsers: options?.defaultUsers,
  });
}

// Mentionable Select Menu Builders

/**
 * Create a mentionable select menu (users and roles)
 */
export function mentionableSelect(config: MentionableSelectConfig): MentionableSelectMenuBuilder {
  const menu = new MentionableSelectMenuBuilder().setCustomId(config.customId);

  if (config.placeholder) {
    menu.setPlaceholder(config.placeholder);
  }

  if (config.disabled) {
    menu.setDisabled(true);
  }

  if (config.minValues !== undefined) {
    menu.setMinValues(config.minValues);
  }

  if (config.maxValues !== undefined) {
    menu.setMaxValues(config.maxValues);
  }

  // Note: MentionableSelectMenuBuilder doesn't support setDefaultMentionables in all versions

  return menu;
}

/**
 * Create a mentionable select menu row
 */
export function mentionableSelectRow(
  config: MentionableSelectConfig
): ActionRowBuilder<MentionableSelectMenuBuilder> {
  return new ActionRowBuilder<MentionableSelectMenuBuilder>().addComponents(
    mentionableSelect(config)
  );
}

/**
 * Create a single mentionable select menu
 */
export function singleMentionableSelect(
  customId: string,
  options?: {
    placeholder?: string;
  }
): MentionableSelectMenuBuilder {
  return mentionableSelect({
    customId,
    placeholder: options?.placeholder ?? 'Select a user or role',
    maxValues: 1,
  });
}
