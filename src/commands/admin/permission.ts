import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import {
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
  InteractionContextType,
  type Role,
  type Guild,
  type User,
  type Message,
} from 'discord.js';
import {
  ephemeralError,
  successContainer,
  infoContainer,
  errorMessage,
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';
import { buildErrorText } from '#lib/discord/index.js';
import {
  createPermissionGrant,
  removePermissionGrant,
  listPermissionGrants,
} from '#lib/validation/permissionResolver.js';
import {
  resolveResourceInput,
  allCategories,
  allCommandKeys,
  getCommand,
  getCategory,
} from '#lib/validation/permissionRegistry.js';
import { UserError, container as sapphireContainer, type Args } from '@sapphire/framework';
import { ValidationError } from '#lib/validation/zod.js';
import type {
  PermissionSubjectType,
  PermissionResourceType,
  PermissionEffect,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Shared option types
// ---------------------------------------------------------------------------

interface PermissionAddOptions {
  resourceInput: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectMention: string;
  deny: boolean;
  guild: Guild;
  moderator: User;
}

interface PermissionRemoveOptions {
  resourceInput: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectMention: string;
  guild: Guild;
}

interface PermissionListOptions {
  role?: Role;
  user?: User;
  resourceInput?: string;
  guild: Guild;
}

// ---------------------------------------------------------------------------
// Shared handlers
// ---------------------------------------------------------------------------

async function handlePermissionAdd(
  options: PermissionAddOptions,
  ctx: CommandResponder
): Promise<void> {
  const resolved = resolveResourceInput(options.resourceInput);
  if (!resolved) {
    await ctx.replyError(
      `Unknown resource: "${options.resourceInput}". Use a valid command or category.`
    );
    return;
  }

  await ctx.defer();

  try {
    const effect: PermissionEffect = options.deny ? 'DENY' : 'ALLOW';

    await createPermissionGrant(
      options.guild.id,
      options.subjectType,
      options.subjectId,
      resolved.type as PermissionResourceType,
      resolved.key,
      effect,
      options.moderator.id
    );

    const resourceDisplay =
      resolved.type === 'CATEGORY'
        ? (getCategory(resolved.key)?.displayName ?? resolved.key)
        : (getCommand(resolved.key)?.displayName ?? resolved.key);

    const result = successContainer()
      .h2('Permission Added')
      .text(
        `**${effect === 'DENY' ? 'Denied' : 'Granted'}** \`${resourceDisplay}\` to ${options.subjectMention}`
      )
      .footer(`${resolved.type}: ${resolved.key}`);

    await ctx.editReply(result);
  } catch (error) {
    sapphireContainer.logger.error('Error adding permission grant:', error);
    await ctx.editReply(errorMessage('Error', 'Failed to add permission grant.'));
  }
}

async function handlePermissionRemove(
  options: PermissionRemoveOptions,
  ctx: CommandResponder
): Promise<void> {
  const resolved = resolveResourceInput(options.resourceInput);
  if (!resolved) {
    await ctx.replyError(
      `Unknown resource: "${options.resourceInput}". Use a valid command or category.`
    );
    return;
  }

  await ctx.defer();

  try {
    const removed = await removePermissionGrant(
      options.guild.id,
      options.subjectType,
      options.subjectId,
      resolved.type as PermissionResourceType,
      resolved.key
    );

    if (!removed) {
      await ctx.editReply(errorMessage('Not Found', 'No matching permission grant found.'));
      return;
    }

    const resourceDisplay =
      resolved.type === 'CATEGORY'
        ? (getCategory(resolved.key)?.displayName ?? resolved.key)
        : (getCommand(resolved.key)?.displayName ?? resolved.key);

    const result = successContainer()
      .h2('Permission Removed')
      .text(`Removed \`${resourceDisplay}\` from ${options.subjectMention}`)
      .footer(`${resolved.type}: ${resolved.key}`);

    await ctx.editReply(result);
  } catch (error) {
    sapphireContainer.logger.error('Error removing permission grant:', error);
    await ctx.editReply(errorMessage('Error', 'Failed to remove permission grant.'));
  }
}

async function handlePermissionList(
  options: PermissionListOptions,
  ctx: CommandResponder
): Promise<void> {
  await ctx.defer();

  try {
    const filters: {
      subjectType?: PermissionSubjectType;
      subjectId?: string;
      resourceType?: PermissionResourceType;
      resourceKey?: string;
    } = {};

    if (options.role) {
      filters.subjectType = 'ROLE';
      filters.subjectId = options.role.id;
    } else if (options.user) {
      filters.subjectType = 'USER';
      filters.subjectId = options.user.id;
    }

    if (options.resourceInput) {
      const resolved = resolveResourceInput(options.resourceInput);
      if (resolved) {
        filters.resourceType = resolved.type as PermissionResourceType;
        filters.resourceKey = resolved.key;
      }
    }

    const grants = await listPermissionGrants(options.guild.id, filters);

    if (grants.length === 0) {
      const result = infoContainer().h2('Permission Grants').text('No permission grants found.');
      await ctx.editReply(result);
      return;
    }

    const lines: string[] = [];
    for (const grant of grants.slice(0, 25)) {
      const subjectMention =
        grant.subjectType === 'ROLE' ? `<@&${grant.subjectId}>` : `<@${grant.subjectId}>`;
      const resourceDisplay =
        grant.resourceType === 'CATEGORY'
          ? (getCategory(grant.resourceKey)?.displayName ?? grant.resourceKey)
          : (getCommand(grant.resourceKey)?.displayName ?? grant.resourceKey);
      const effectIcon = grant.effect === 'ALLOW' ? '✅' : '❌';
      lines.push(
        `${effectIcon} ${subjectMention} → \`${resourceDisplay}\` (${grant.resourceType.toLowerCase()})`
      );
    }

    const result = infoContainer()
      .h2('Permission Grants')
      .text(lines.join('\n'))
      .when(grants.length > 25, (c) => c.footer(`Showing 25 of ${grants.length} grants`));

    await ctx.editReply(result);
  } catch (error) {
    sapphireContainer.logger.error('Error listing permission grants:', error);
    await ctx.editReply(errorMessage('Error', 'Failed to list permission grants.'));
  }
}

// ---------------------------------------------------------------------------
// Message argument parsers
// ---------------------------------------------------------------------------

/**
 * Parse a role or user mention from args. Tries role first, then user.
 * Returns the subject type, ID, and mention string.
 */
async function pickSubject(
  args: Args,
  usage: string
): Promise<{ subjectType: PermissionSubjectType; subjectId: string; subjectMention: string }> {
  // Try role mention first
  args.save();
  try {
    const role = await args.pick('role');
    return {
      subjectType: 'ROLE',
      subjectId: role.id,
      subjectMention: `<@&${role.id}>`,
    };
  } catch (err) {
    sapphireContainer.logger.debug('pickSubject: role resolver failed, trying user:', err);
    args.restore();
  }

  // Try user mention
  try {
    const user = await args.pick('user');
    return {
      subjectType: 'USER',
      subjectId: user.id,
      subjectMention: `<@${user.id}>`,
    };
  } catch (err) {
    sapphireContainer.logger.debug('pickSubject: user resolver also failed:', err);
    throw new UserError({
      identifier: 'MissingArg',
      message: `Missing required argument: \`@role or @user\`. Usage: \`${usage}\``,
    });
  }
}

async function parsePermissionAddFromMessage(
  message: Message,
  args: Args
): Promise<PermissionAddOptions> {
  if (!message.guild) {
    throw new UserError({
      identifier: 'GuildOnly',
      message: 'This command can only be used in a server.',
    });
  }

  const resourceInput = await args.pick('string').catch(() => {
    throw new UserError({
      identifier: 'MissingArg',
      message:
        'Missing required argument: `resource`. Usage: `!permission add <resource> <@role|@user> [deny]`',
    });
  });

  const subject = await pickSubject(args, '!permission add <resource> <@role|@user> [deny]');

  let deny = false;
  try {
    const word = (await args.pick('string')).toLowerCase();
    deny = word === 'deny' || word === 'true';
  } catch (err) {
    sapphireContainer.logger.debug(
      'parsePermissionAdd: no deny flag provided, defaulting to false:',
      err
    );
  }

  return {
    resourceInput,
    ...subject,
    deny,
    guild: message.guild,
    moderator: message.author,
  };
}

async function parsePermissionRemoveFromMessage(
  message: Message,
  args: Args
): Promise<PermissionRemoveOptions> {
  if (!message.guild) {
    throw new UserError({
      identifier: 'GuildOnly',
      message: 'This command can only be used in a server.',
    });
  }

  const resourceInput = await args.pick('string').catch(() => {
    throw new UserError({
      identifier: 'MissingArg',
      message:
        'Missing required argument: `resource`. Usage: `!permission remove <resource> <@role|@user>`',
    });
  });

  const subject = await pickSubject(args, '!permission remove <resource> <@role|@user>');

  return {
    resourceInput,
    ...subject,
    guild: message.guild,
  };
}

async function parsePermissionListFromMessage(
  message: Message,
  args: Args
): Promise<PermissionListOptions> {
  if (!message.guild) {
    throw new UserError({
      identifier: 'GuildOnly',
      message: 'This command can only be used in a server.',
    });
  }

  let role: Role | undefined;
  let user: User | undefined;

  // Try role mention first, then user mention (both optional)
  args.save();
  try {
    role = await args.pick('role');
  } catch (err) {
    sapphireContainer.logger.debug('parsePermissionList: role resolver failed, trying user:', err);
    args.restore();
    try {
      user = await args.pick('user');
    } catch (err2) {
      sapphireContainer.logger.debug('parsePermissionList: no role or user filter provided:', err2);
    }
  }

  let resourceInput: string | undefined;
  try {
    resourceInput = await args.pick('string');
  } catch (err) {
    sapphireContainer.logger.debug('parsePermissionList: no resource filter provided:', err);
  }

  return {
    role,
    user,
    resourceInput,
    guild: message.guild,
  };
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

@ApplyOptions<Subcommand.Options>({
  name: 'permission',
  aliases: ['perms'],
  description: 'Manage custom permissions for roles and users',
  requiredClientPermissions: [PermissionFlagsBits.ManageRoles],
  subcommands: [
    { name: 'help', default: true, messageRun: 'messagePermissionHelp' },
    { name: 'add', chatInputRun: 'chatInputAdd', messageRun: 'messageAdd' },
    { name: 'remove', chatInputRun: 'chatInputRemove', messageRun: 'messageRemove' },
    { name: 'list', chatInputRun: 'chatInputList', messageRun: 'messageList' },
  ],
})
export class PermissionCommand extends Subcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(this.buildAddSubcommand)
        .addSubcommand(this.buildRemoveSubcommand)
        .addSubcommand(this.buildListSubcommand)
    );
  }

  private buildAddSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('add')
      .setDescription('Grant a permission to a role or user')
      .addStringOption((option) =>
        option
          .setName('resource')
          .setDescription('Command or category to grant (e.g., "warn", "mod.kick", "moderation")')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addRoleOption((option) =>
        option.setName('role').setDescription('Role to grant permission to')
      )
      .addUserOption((option) =>
        option.setName('user').setDescription('User to grant permission to')
      )
      .addBooleanOption((option) =>
        option.setName('deny').setDescription('Deny instead of allow (default: false)')
      );
  }

  private buildRemoveSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('remove')
      .setDescription('Remove a permission grant from a role or user')
      .addStringOption((option) =>
        option
          .setName('resource')
          .setDescription('Command or category to remove (e.g., "warn", "mod.kick", "moderation")')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addRoleOption((option) =>
        option.setName('role').setDescription('Role to remove permission from')
      )
      .addUserOption((option) =>
        option.setName('user').setDescription('User to remove permission from')
      );
  }

  private buildListSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('list')
      .setDescription('List permission grants')
      .addRoleOption((option) => option.setName('role').setDescription('Filter by role'))
      .addUserOption((option) => option.setName('user').setDescription('Filter by user'))
      .addStringOption((option) =>
        option
          .setName('resource')
          .setDescription('Filter by command or category')
          .setAutocomplete(true)
      );
  }

  // ============================================================================
  // Slash command handlers
  // ============================================================================

  public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply(ephemeralError('This command can only be used in a server.'));
      return;
    }

    const resourceInput = interaction.options.getString('resource', true);
    const role = interaction.options.getRole('role') as Role | null;
    const user = interaction.options.getUser('user');
    const deny = interaction.options.getBoolean('deny') ?? false;

    if (!role && !user) {
      await interaction.reply(ephemeralError('You must specify either a role or a user.'));
      return;
    }

    if (role && user) {
      await interaction.reply(ephemeralError('Please specify only one: role or user.'));
      return;
    }

    const subjectType: PermissionSubjectType = role ? 'ROLE' : 'USER';
    const subjectId = role ? role.id : user!.id;
    const subjectMention = role ? `<@&${role.id}>` : `<@${user!.id}>`;

    return handlePermissionAdd(
      {
        resourceInput,
        subjectType,
        subjectId,
        subjectMention,
        deny,
        guild: interaction.guild,
        moderator: interaction.user,
      },
      new InteractionResponder(interaction)
    );
  }

  public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply(ephemeralError('This command can only be used in a server.'));
      return;
    }

    const resourceInput = interaction.options.getString('resource', true);
    const role = interaction.options.getRole('role') as Role | null;
    const user = interaction.options.getUser('user');

    if (!role && !user) {
      await interaction.reply(ephemeralError('You must specify either a role or a user.'));
      return;
    }

    if (role && user) {
      await interaction.reply(ephemeralError('Please specify only one: role or user.'));
      return;
    }

    const subjectType: PermissionSubjectType = role ? 'ROLE' : 'USER';
    const subjectId = role ? role.id : user!.id;
    const subjectMention = role ? `<@&${role.id}>` : `<@${user!.id}>`;

    return handlePermissionRemove(
      { resourceInput, subjectType, subjectId, subjectMention, guild: interaction.guild },
      new InteractionResponder(interaction)
    );
  }

  public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply(ephemeralError('This command can only be used in a server.'));
      return;
    }

    const role = (interaction.options.getRole('role') as Role | null) ?? undefined;
    const user = interaction.options.getUser('user') ?? undefined;
    const resourceInput = interaction.options.getString('resource') ?? undefined;

    return handlePermissionList(
      { role, user, resourceInput, guild: interaction.guild },
      new InteractionResponder(interaction)
    );
  }

  // ============================================================================
  // Message command handlers (prefix)
  // ============================================================================

  private async handleMessageCommand<T>(
    message: Message,
    args: Args,
    parser: (message: Message, args: Args) => Promise<T>,
    handler: (options: T, ctx: CommandResponder) => Promise<unknown>
  ): Promise<unknown> {
    // Prefix commands don't have setDefaultMemberPermissions, so check manually
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      if (message.channel.isSendable()) {
        return message.channel.send({
          content: buildErrorText('You need Administrator permission to use this command.'),
          allowedMentions: { parse: [] },
        });
      }
      return;
    }

    try {
      const options = await parser(message, args);
      return handler(options, new MessageResponder(message as Message<true>));
    } catch (error) {
      if (error instanceof UserError || error instanceof ValidationError) {
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

  public async messagePermissionHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Permission Commands**',
        `\`${prefix}perms add <resource> <@role|@user> [deny]\` — Grant or deny a permission`,
        `\`${prefix}perms remove <resource> <@role|@user>\` — Remove a permission override`,
        `\`${prefix}perms list [@role|@user] [resource]\` — List permission overrides`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }

  public async messageAdd(message: Message, args: Args) {
    return this.handleMessageCommand(
      message,
      args,
      parsePermissionAddFromMessage,
      handlePermissionAdd
    );
  }

  public async messageRemove(message: Message, args: Args) {
    return this.handleMessageCommand(
      message,
      args,
      parsePermissionRemoveFromMessage,
      handlePermissionRemove
    );
  }

  public async messageList(message: Message, args: Args) {
    return this.handleMessageCommand(
      message,
      args,
      parsePermissionListFromMessage,
      handlePermissionList
    );
  }

  // ============================================================================
  // Autocomplete
  // ============================================================================

  public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'resource') {
      const query = focusedOption.value.toLowerCase();
      const results: { name: string; value: string }[] = [];

      for (const category of allCategories()) {
        if (category.key.includes(query) || category.displayName.toLowerCase().includes(query)) {
          results.push({
            name: `${category.displayName} (category)`,
            value: category.key,
          });
        }
      }

      for (const cmdKey of allCommandKeys()) {
        const cmd = getCommand(cmdKey);
        if (cmd && (cmdKey.includes(query) || cmd.displayName.toLowerCase().includes(query))) {
          results.push({
            name: `${cmd.displayName} (${cmdKey})`,
            value: cmdKey,
          });
        }
      }

      await interaction.respond(results.slice(0, 25));
    }
  }
}
