/**
 * /voice setup - Interactive setup wizard for configuring the temp voice system.
 *
 * Follows the same collector-based interaction pattern as /mod setup.
 * Requires ManageGuild permission.
 */

import { container } from '@sapphire/framework';
import {
  MessageFlags,
  ChannelType,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  type Guild,
  type Message,
} from 'discord.js';
import {
  row,
  button,
  channelSelectRow,
  stringSelectRow,
  EMOJI,
  successMessage,
  warningMessage,
  infoContainer,
  errorContainer,
  type CommandResponder,
} from '#lib/discord/index.js';
import { getTempVoiceServices } from '../../modules/temp-voice/services/service-container.js';
import type { TempVoiceConfig } from '../../modules/temp-voice/models/config.model.js';
import { TempVoiceNamingScheme } from '@prisma/client';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CUSTOM_ID_PREFIX = 'tv_setup';
const COLLECTOR_TIMEOUT = 300_000; // 5 minutes
const SELECT_TIMEOUT = 60_000; // 1 minute for individual selections

const NAMING_SCHEME_LABELS: Record<string, { label: string; description: string }> = {
  USERNAME: {
    label: 'Username',
    description: 'Uses Discord username (e.g., "alice\'s Channel")',
  },
  DISPLAYNAME: {
    label: 'Display Name',
    description: 'Uses server nickname (e.g., "Alice\'s Channel")',
  },
  SEQUENTIAL: {
    label: 'Sequential',
    description: 'Numbered channels (e.g., "Channel 1", "Channel 2")',
  },
  CUSTOM: {
    label: 'Custom Template',
    description: 'Uses a custom name template',
  },
};

// ─────────────────────────────────────────────
// UI Builders
// ─────────────────────────────────────────────

function buildSetupRow1(config: TempVoiceConfig) {
  return row(
    button({
      customId: `${CUSTOM_ID_PREFIX}:jtc_channel`,
      label: 'Set JTC Channel',
      style: config.joinToCreateChannels.length > 0 ? ButtonStyle.Success : ButtonStyle.Primary,
      emoji: EMOJI.VOICE.ICONS.GENERIC,
    }),
    button({
      customId: `${CUSTOM_ID_PREFIX}:category`,
      label: 'Set Category',
      style: config.categoryId ? ButtonStyle.Success : ButtonStyle.Primary,
      emoji: EMOJI.CHANNELS.TYPES.FOLDER,
    }),
    button({
      customId: `${CUSTOM_ID_PREFIX}:log_channel`,
      label: 'Set Log Channel',
      style: config.logChannelId ? ButtonStyle.Success : ButtonStyle.Secondary,
      emoji: EMOJI.CHANNELS.TYPES.TEXT,
    })
  );
}

function buildSetupRow2() {
  return row(
    button({
      customId: `${CUSTOM_ID_PREFIX}:naming_scheme`,
      label: 'Naming Scheme',
      style: ButtonStyle.Secondary,
      emoji: EMOJI.UI.ACTIONS.EDIT,
    }),
    button({
      customId: `${CUSTOM_ID_PREFIX}:done`,
      label: 'Done',
      style: ButtonStyle.Success,
      emoji: EMOJI.STATUS.SUCCESS,
    })
  );
}

function buildSetupContainer(config: TempVoiceConfig) {
  const jtcDisplay =
    config.joinToCreateChannels.length > 0
      ? config.joinToCreateChannels.map((id) => `<#${id}>`).join(', ')
      : '`Not set`';

  const settings: Record<string, string> = {
    'Join to Create Channel': jtcDisplay,
    Category: config.categoryId ? `<#${config.categoryId}>` : '`Not set`',
    'Log Channel': config.logChannelId ? `<#${config.logChannelId}>` : '`Not set`',
    'Naming Scheme': `\`${NAMING_SCHEME_LABELS[config.namingScheme]?.label ?? config.namingScheme}\``,
  };

  const steps = [
    'Set a Join to Create voice channel (users join it to create a temp channel)',
    'Set the category where temp channels are created',
    'Set a log channel for temp voice events (optional)',
    'Choose a naming scheme for created channels',
  ];

  return infoContainer()
    .h2(`${EMOJI.VOICE.ICONS.GENERIC} Temp Voice Setup`)
    .separator()
    .h2('Current Settings')
    .kv(settings)
    .h2('Setup Steps')
    .numberedList(steps)
    .divider()
    .text('-# Use the buttons below to configure each setting');
}

// ─────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────

export async function handleVoiceSetup(ctx: CommandResponder) {
  const { member } = ctx;
  if (
    !member.permissions.has(PermissionFlagsBits.ManageGuild) &&
    !member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return ctx.reply(
      errorContainer()
        .h2('Permission Denied')
        .text(
          'You need **Manage Server** or **Administrator** permissions to configure temp voice settings.'
        )
    );
  }

  await ctx.defer();

  const { config: configService } = getTempVoiceServices();

  // Get or create config (get auto-creates with defaults)
  const config = await configService.get(ctx.guild.id);

  return showSetupOverview(ctx, config);
}

// ─────────────────────────────────────────────
// Overview & Collector
// ─────────────────────────────────────────────

async function showSetupOverview(ctx: CommandResponder, config: TempVoiceConfig) {
  const setupContainer = buildSetupContainer(config).actions(
    buildSetupRow1(config),
    buildSetupRow2()
  );

  const message = await ctx.editReply(setupContainer);

  await handleSetupInteractions(ctx, message);
}

async function handleSetupInteractions(ctx: CommandResponder, message: Message) {
  const guild = ctx.guild;
  const guildId = guild.id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === ctx.user.id,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async (buttonInteraction) => {
    const customId = buttonInteraction.customId;

    try {
      // ── Done ──
      if (customId === `${CUSTOM_ID_PREFIX}:done`) {
        const finalConfig = await getTempVoiceServices().config.get(guildId);

        // Warn if minimum requirements are not met
        if (finalConfig.joinToCreateChannels.length === 0) {
          await buttonInteraction.update({
            components: [
              warningMessage(
                'Setup Incomplete',
                "Your settings have been saved, but no **Join to Create** channel is configured. The temp voice system won't work until one is set.\nRun `/voice setup` again to finish."
              ).build(),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          await buttonInteraction.update({
            components: [
              successMessage('Setup Complete', 'Your temp voice settings have been saved.').build(),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        collector.stop();
        return;
      }

      // ── Set JTC Channel ──
      if (customId === `${CUSTOM_ID_PREFIX}:jtc_channel`) {
        await handleJtcChannel(ctx, buttonInteraction, guild, guildId);
        return;
      }

      // ── Set Category ──
      if (customId === `${CUSTOM_ID_PREFIX}:category`) {
        await handleCategory(ctx, buttonInteraction, guild, guildId);
        return;
      }

      // ── Set Log Channel ──
      if (customId === `${CUSTOM_ID_PREFIX}:log_channel`) {
        await handleLogChannel(ctx, buttonInteraction, guildId);
        return;
      }

      // ── Naming Scheme ──
      if (customId === `${CUSTOM_ID_PREFIX}:naming_scheme`) {
        await handleNamingScheme(ctx, buttonInteraction, guildId);
        return;
      }

      // Unknown button
      await buttonInteraction.deferUpdate();
    } catch (error) {
      container.logger.error('[TempVoice Setup] Button interaction error:', error);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      try {
        await ctx.editReply(
          warningMessage(
            'Setup Timed Out',
            'The setup wizard has timed out. Run the voice setup command again to continue.'
          )
        );
      } catch {
        // Message may be deleted
      }
    }
  });
}

// ─────────────────────────────────────────────
// Individual Setting Handlers
// ─────────────────────────────────────────────

async function handleJtcChannel(
  ctx: CommandResponder,
  buttonInteraction: any,
  guild: Guild,
  guildId: string
) {
  // Offer two options: select existing channel or auto-create
  const selectRow = channelSelectRow({
    customId: `${CUSTOM_ID_PREFIX}:select_jtc`,
    placeholder: 'Select an existing voice channel',
    channelTypes: [ChannelType.GuildVoice],
  });

  const autoCreateRow = row(
    button({
      customId: `${CUSTOM_ID_PREFIX}:auto_create_jtc`,
      label: 'Auto-Create Channel',
      style: ButtonStyle.Secondary,
      emoji: EMOJI.CHANNELS.ACTIONS.CREATE,
    })
  );

  await buttonInteraction.reply({
    content: `${EMOJI.VOICE.ICONS.GENERIC} Select an existing voice channel to use as a **Join to Create** trigger, or auto-create one:`,
    components: [selectRow, autoCreateRow],
    flags: MessageFlags.Ephemeral,
  });

  try {
    const collected = await buttonInteraction.channel?.awaitMessageComponent({
      filter: (i: any) =>
        i.user.id === ctx.user.id &&
        (i.customId === `${CUSTOM_ID_PREFIX}:select_jtc` ||
          i.customId === `${CUSTOM_ID_PREFIX}:auto_create_jtc`),
      time: SELECT_TIMEOUT,
    });

    if (!collected) return;

    const { config: configService } = getTempVoiceServices();

    if (collected.customId === `${CUSTOM_ID_PREFIX}:auto_create_jtc`) {
      // Auto-create a JTC voice channel
      await collected.deferUpdate();

      const currentConfig = await configService.get(guildId);
      const parent = currentConfig.categoryId
        ? await guild.channels.fetch(currentConfig.categoryId).catch(() => null)
        : null;

      const jtcChannel = await guild.channels.create({
        name: 'Join to Create',
        type: ChannelType.GuildVoice,
        parent: parent?.id ?? undefined,
        reason: 'Auto-created by /voice setup',
      });

      await configService.addJoinChannel(guildId, jtcChannel.id);

      await collected.editReply({
        content: `${EMOJI.STATUS.SUCCESS} Created and set JTC channel: <#${jtcChannel.id}>`,
        components: [],
      });
    } else if (collected.componentType === ComponentType.ChannelSelect) {
      const channelId = collected.values[0];
      if (channelId) {
        // Replace existing JTC channels with the selected one
        await configService.update(guildId, {
          joinToCreateChannels: [channelId],
        });

        await collected.update({
          content: `${EMOJI.STATUS.SUCCESS} Join to Create channel set to <#${channelId}>`,
          components: [],
        });
      }
    }

    // Refresh overview
    await refreshOverview(ctx, guildId);
  } catch {
    // Timeout - ignore
  }
}

async function handleCategory(
  ctx: CommandResponder,
  buttonInteraction: any,
  guild: Guild,
  guildId: string
) {
  const selectRow = channelSelectRow({
    customId: `${CUSTOM_ID_PREFIX}:select_category`,
    placeholder: 'Select an existing category',
    channelTypes: [ChannelType.GuildCategory],
  });

  const autoCreateRow = row(
    button({
      customId: `${CUSTOM_ID_PREFIX}:auto_create_category`,
      label: 'Auto-Create Category',
      style: ButtonStyle.Secondary,
      emoji: EMOJI.CHANNELS.ACTIONS.CREATE,
    })
  );

  await buttonInteraction.reply({
    content: `${EMOJI.CHANNELS.TYPES.FOLDER} Select an existing category for temp voice channels, or auto-create one:`,
    components: [selectRow, autoCreateRow],
    flags: MessageFlags.Ephemeral,
  });

  try {
    const collected = await buttonInteraction.channel?.awaitMessageComponent({
      filter: (i: any) =>
        i.user.id === ctx.user.id &&
        (i.customId === `${CUSTOM_ID_PREFIX}:select_category` ||
          i.customId === `${CUSTOM_ID_PREFIX}:auto_create_category`),
      time: SELECT_TIMEOUT,
    });

    if (!collected) return;

    const { config: configService } = getTempVoiceServices();

    if (collected.customId === `${CUSTOM_ID_PREFIX}:auto_create_category`) {
      await collected.deferUpdate();

      const category = await guild.channels.create({
        name: 'Temp Voice',
        type: ChannelType.GuildCategory,
        reason: 'Auto-created by /voice setup',
      });

      await configService.update(guildId, { categoryId: category.id });

      await collected.editReply({
        content: `${EMOJI.STATUS.SUCCESS} Created and set category: **${category.name}**`,
        components: [],
      });
    } else if (collected.componentType === ComponentType.ChannelSelect) {
      const channelId = collected.values[0];
      if (channelId) {
        await configService.update(guildId, { categoryId: channelId });

        await collected.update({
          content: `${EMOJI.STATUS.SUCCESS} Category set to <#${channelId}>`,
          components: [],
        });
      }
    }

    await refreshOverview(ctx, guildId);
  } catch {
    // Timeout - ignore
  }
}

async function handleLogChannel(ctx: CommandResponder, buttonInteraction: any, guildId: string) {
  const selectRow = channelSelectRow({
    customId: `${CUSTOM_ID_PREFIX}:select_log`,
    placeholder: 'Select a text channel for logs',
    channelTypes: [ChannelType.GuildText],
  });

  await buttonInteraction.reply({
    content: `${EMOJI.CHANNELS.TYPES.TEXT} Select a text channel for temp voice logs:`,
    components: [selectRow],
    flags: MessageFlags.Ephemeral,
  });

  try {
    const collected = await buttonInteraction.channel?.awaitMessageComponent({
      filter: (i: any) =>
        i.user.id === ctx.user.id && i.customId === `${CUSTOM_ID_PREFIX}:select_log`,
      componentType: ComponentType.ChannelSelect,
      time: SELECT_TIMEOUT,
    });

    if (collected) {
      const channelId = collected.values[0];
      if (channelId) {
        await collected.deferUpdate();
        const { config: configService } = getTempVoiceServices();

        // Create a webhook in the selected log channel
        const logChannel = await collected.guild?.channels.fetch(channelId);
        let webhookUrl: string | null = null;

        if (logChannel && 'createWebhook' in logChannel) {
          try {
            const webhook = await logChannel.createWebhook({
              name: 'Temp Voice Logs',
              reason: 'Auto-created by /voice setup',
            });
            webhookUrl = webhook.url;
          } catch (err) {
            container.logger.warn('[TempVoice Setup] Failed to create webhook:', err);
          }
        }

        await configService.update(guildId, {
          logChannelId: channelId,
          ...(webhookUrl && { logWebhook: webhookUrl }),
        });

        await collected.editReply({
          content: webhookUrl
            ? `${EMOJI.STATUS.SUCCESS} Log channel set to <#${channelId}>`
            : `${EMOJI.STATUS.WARNING} Log channel set to <#${channelId}>, but could not create a webhook. Logs may not work.`,
          components: [],
        });

        await refreshOverview(ctx, guildId);
      }
    }
  } catch {
    // Timeout - ignore
  }
}

async function handleNamingScheme(ctx: CommandResponder, buttonInteraction: any, guildId: string) {
  const selectRow = stringSelectRow({
    customId: `${CUSTOM_ID_PREFIX}:select_naming`,
    placeholder: 'Choose a naming scheme',
    options: Object.entries(NAMING_SCHEME_LABELS).map(([value, { label, description }]) => ({
      label,
      description,
      value,
    })),
  });

  await buttonInteraction.reply({
    content: `${EMOJI.UI.ACTIONS.EDIT} Choose how temporary voice channels are named:`,
    components: [selectRow],
    flags: MessageFlags.Ephemeral,
  });

  try {
    const collected = await buttonInteraction.channel?.awaitMessageComponent({
      filter: (i: any) =>
        i.user.id === ctx.user.id && i.customId === `${CUSTOM_ID_PREFIX}:select_naming`,
      componentType: ComponentType.StringSelect,
      time: SELECT_TIMEOUT,
    });

    if (collected) {
      const value = collected.values[0];
      if (value) {
        const validSchemes = Object.values(TempVoiceNamingScheme);
        if (!validSchemes.includes(value as TempVoiceNamingScheme)) {
          await collected.update({
            content: `${EMOJI.STATUS.ERROR} Invalid naming scheme: \`${value}\``,
            components: [],
          });
          return;
        }

        const { config: configService } = getTempVoiceServices();
        await configService.update(guildId, {
          namingScheme: value as TempVoiceNamingScheme,
        });

        const label = NAMING_SCHEME_LABELS[value]?.label ?? value;
        await collected.update({
          content: `${EMOJI.STATUS.SUCCESS} Naming scheme set to **${label}**`,
          components: [],
        });

        await refreshOverview(ctx, guildId);
      }
    }
  } catch {
    // Timeout - ignore
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function refreshOverview(ctx: CommandResponder, guildId: string) {
  const { config: configService } = getTempVoiceServices();
  const config = await configService.get(guildId);

  const setupContainer = buildSetupContainer(config).actions(
    buildSetupRow1(config),
    buildSetupRow2()
  );

  await ctx.editReply(setupContainer);
}
