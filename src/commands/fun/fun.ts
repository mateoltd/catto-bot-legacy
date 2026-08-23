/**
 * Fun command - Fun interactive commands for the server
 */

import { Subcommand } from '@sapphire/plugin-subcommands';
import {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type Guild,
  type User,
} from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { type BonkStyle, type BonkVisualConfig } from '#lib/services/image-gen-types.js';
import { imageGenClient } from '#lib/services/image-gen-client.js';
import { CONFIG } from '#config.js';
import {
  buildModerationContext,
  executeBan,
  executeTimeout,
} from '#modules/moderation/handlers/index.js';
import { moderationService } from '#modules/moderation/services/ModerationService.js';
import { asDuration } from '#modules/moderation/domain/types.js';

// --- Bonk intensity system (only used when effects=true) ---

type BonkIntensity = Omit<BonkVisualConfig, 'textStrokeWidth'>;

const BONK_INTENSITIES: BonkIntensity[] = [
  {
    bonkText: '*bonk*',
    fontSize: 28,
    starCount: 1,
    showSpeedLines: false,
    showDamageNumber: false,
    textColor: '#FFFFFF',
    glowColor: 'transparent',
  },
  {
    bonkText: '*bonk*',
    fontSize: 32,
    starCount: 2,
    showSpeedLines: false,
    showDamageNumber: false,
    textColor: '#FFFFFF',
    glowColor: 'transparent',
  },
  {
    bonkText: '*BONK*',
    fontSize: 40,
    starCount: 3,
    showSpeedLines: false,
    showDamageNumber: false,
    textColor: '#FFD700',
    glowColor: 'rgba(255,165,0,0.3)',
  },
  {
    bonkText: '*BONK!*',
    fontSize: 44,
    starCount: 3,
    showSpeedLines: false,
    showDamageNumber: false,
    textColor: '#FFD700',
    glowColor: 'rgba(255,165,0,0.3)',
  },
  {
    bonkText: '*BIG BONK!*',
    fontSize: 48,
    starCount: 4,
    showSpeedLines: false,
    showDamageNumber: true,
    textColor: '#FFD700',
    glowColor: 'rgba(255,165,0,0.4)',
  },
  {
    bonkText: '*MEGA BONK!*',
    fontSize: 40,
    starCount: 5,
    showSpeedLines: true,
    showDamageNumber: true,
    textColor: '#FF6B00',
    glowColor: 'rgba(255,100,0,0.5)',
  },
  {
    bonkText: '*SUPER BONK!*',
    fontSize: 42,
    starCount: 6,
    showSpeedLines: true,
    showDamageNumber: true,
    textColor: '#FF6B00',
    glowColor: 'rgba(255,100,0,0.5)',
  },
  {
    bonkText: '*CRITICAL!*',
    fontSize: 40,
    starCount: 8,
    showSpeedLines: true,
    showDamageNumber: true,
    textColor: '#FF0000',
    glowColor: 'rgba(255,0,0,0.6)',
  },
  {
    bonkText: '*DEVASTATING!*',
    fontSize: 42,
    starCount: 9,
    showSpeedLines: true,
    showDamageNumber: true,
    textColor: '#FF0000',
    glowColor: 'rgba(255,0,0,0.7)',
  },
  {
    bonkText: '*ULTRA BONK!*',
    fontSize: 48,
    starCount: 12,
    showSpeedLines: true,
    showDamageNumber: true,
    textColor: '#FF00FF',
    glowColor: 'rgba(255,0,255,0.7)',
  },
];

/** Weighted random: 25% gentle, 30% normal, 25% mega, 15% critical, 5% ultra */
function getRandomIntensity(): BonkIntensity {
  const roll = Math.random() * 100;
  let min: number;
  let max: number;
  if (roll < 25) {
    min = 0;
    max = 1;
  } else if (roll < 55) {
    min = 2;
    max = 4;
  } else if (roll < 80) {
    min = 5;
    max = 6;
  } else if (roll < 95) {
    min = 7;
    max = 8;
  } else {
    min = 9;
    max = 9;
  }
  const idx = min + Math.floor(Math.random() * (max - min + 1));
  return BONK_INTENSITIES[idx] as BonkIntensity;
}

function intensityToVisuals(intensity: BonkIntensity): BonkVisualConfig {
  return {
    ...intensity,
    textStrokeWidth: Math.max(2, Math.floor(intensity.fontSize / 15)),
  };
}

const BONK_MESSAGES = [
  '{bonker} bonked {bonked}',
  '{bonker} bonked {bonked}!',
  '{bonker} bonked {bonked} real good',
  '{bonker} delivered a bonk to {bonked}',
  '{bonker} sent {bonked} to the shadow realm',
];

const SELF_BONK_MESSAGES = ['{user} bonked themselves', '{user} performed a self-bonk'];

const SUPERBONK_REASONS = [
  'Bonked into the shadow realm',
  'Critical bonk - sent to another dimension',
  'Received a bonk so powerful it transcended server boundaries',
  'Obliterated by a bonk of unprecedented magnitude',
  'Super mega ultra bonked out of existence',
] as const;

const SUPERBONK_VISUALS: BonkVisualConfig = {
  bonkText: 'MEGA ULTRA BONK!',
  fontSize: 42,
  starCount: 15,
  showSpeedLines: false,
  showDamageNumber: false,
  textColor: '#FF00FF',
  glowColor: 'rgba(255,0,255,0.8)',
  textStrokeWidth: 4,
};

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export class FunCommand extends Subcommand {
  public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
    super(context, {
      ...options,
      name: 'fun',
      description: 'Fun interactive commands',
      cooldownDelay: 10_000,
      cooldownLimit: 3,
      subcommands: [
        {
          name: 'bonk',
          chatInputRun: 'chatInputBonk',
        },
        {
          name: 'superbonk',
          chatInputRun: 'chatInputSuperBonk',
        },
      ],
    });
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((sub) =>
          sub
            .setName('bonk')
            .setDescription('Bonk someone with a bat!')
            .addUserOption((opt) =>
              opt.setName('target').setDescription('The user to bonk').setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName('style')
                .setDescription('Bonk meme style (default: doge)')
                .addChoices(
                  { name: 'Doge', value: 'doge' },
                  { name: 'Cat', value: 'cat' },
                  { name: 'Lions', value: 'lions' },
                  { name: 'Rabbit', value: 'rabbit' },
                  { name: 'Capybara', value: 'capybara' }
                )
                .setRequired(false)
            )
            .addBooleanOption((opt) =>
              opt
                .setName('effects')
                .setDescription('Add random intensity effects to the image')
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('superbonk')
            .setDescription('The ultimate bonk (owner-only)')
            .addUserOption((opt) =>
              opt.setName('target').setDescription('The user to super bonk').setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName('type')
                .setDescription('Punishment type (default: ban)')
                .addChoices(
                  { name: 'Ban', value: 'ban' },
                  { name: 'Timeout (1m)', value: 'timeout' }
                )
                .setRequired(false)
            )
        )
    );
  }

  public async chatInputBonk(interaction: Subcommand.ChatInputCommandInteraction) {
    await interaction.deferReply();

    if (!interaction.guild || !interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const targetUser = interaction.options.getUser('target', true);
    const style = (interaction.options.getString('style') ?? 'doge') as BonkStyle;
    const effects = interaction.options.getBoolean('effects') ?? false;
    const bonkerUser = interaction.user;
    const isSelfBonk = bonkerUser.id === targetUser.id;

    try {
      await this.container.redis.incr(`bonk:guild:${interaction.guildId}:bonked:${targetUser.id}`);
      await this.container.redis.incr(`bonk:guild:${interaction.guildId}:bonker:${bonkerUser.id}`);
    } catch {
      // Redis unavailable, continue without tracking
    }

    const visuals = effects ? intensityToVisuals(getRandomIntensity()) : undefined;

    let bonkMessage: string;
    if (isSelfBonk) {
      bonkMessage = effects ? randomFrom(SELF_BONK_MESSAGES) : '{user} bonked themselves';
    } else {
      bonkMessage = effects ? randomFrom(BONK_MESSAGES) : '{bonker} bonked {bonked}';
    }
    bonkMessage = bonkMessage
      .replace(/\{bonker\}/g, `${bonkerUser}`)
      .replace(/\{bonked\}/g, `${targetUser}`)
      .replace(/\{user\}/g, `${bonkerUser}`);

    try {
      const imageBuffer = await imageGenClient.generateBonk({
        bonkerAvatarUrl: bonkerUser.displayAvatarURL({ extension: 'png', size: 256 }),
        bonkedAvatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
        style,
        visuals,
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'bonk.png' });

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(bonkMessage)
        .setImage('attachment://bonk.png');

      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (!isSelfBonk) {
        const bonkBackButton = new ButtonBuilder()
          .setCustomId(`bonk:back:${targetUser.id}:${bonkerUser.id}:${style}`)
          .setLabel('Bonk Back')
          .setStyle(ButtonStyle.Secondary);

        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(bonkBackButton));
      }

      return interaction.editReply({
        embeds: [embed],
        files: [attachment],
        components,
        allowedMentions: { users: [bonkerUser.id, targetUser.id] },
      });
    } catch (error) {
      this.container.logger.error('Failed to generate bonk image:', error);

      return interaction.editReply({
        content: bonkMessage,
        allowedMentions: { users: [bonkerUser.id, targetUser.id] },
      });
    }
  }

  public async chatInputSuperBonk(interaction: Subcommand.ChatInputCommandInteraction) {
    if (!CONFIG.OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used by bot owners.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    if (!interaction.guild || !interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const targetUser = interaction.options.getUser('target', true);
    const action = (interaction.options.getString('type') ?? 'ban') as 'ban' | 'timeout';
    const bonkerUser = interaction.user;

    // Pre-check: can the bot moderate this target?
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      const moderatorMember = await interaction.guild.members.fetch(bonkerUser.id);
      const check = moderationService.canModerate(moderatorMember, targetMember);
      if (!check.canModerate) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Cannot superbonk this target: ${check.reason}`,
        });
      }
    }

    const banReason = randomFrom(SUPERBONK_REASONS);
    const reason = `Super Bonk: ${banReason}`;

    try {
      const imageBuffer = await imageGenClient.generateBonk({
        bonkerAvatarUrl: bonkerUser.displayAvatarURL({ extension: 'png', size: 256 }),
        bonkedAvatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
        style: 'doge_fatality',
        visuals: SUPERBONK_VISUALS,
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'superbonk.png' });

      // DM the target before punishment
      try {
        const dmAttachment = new AttachmentBuilder(imageBuffer, { name: 'superbonk.png' });
        const dmEmbed = new EmbedBuilder()
          .setColor(0xff00ff)
          .setTitle('SUPER MEGA ULTRA BONK!')
          .setDescription(banReason)
          .setImage('attachment://superbonk.png')
          .setFooter({ text: `From: ${interaction.guild.name}` });
        await targetUser.send({ embeds: [dmEmbed], files: [dmAttachment] });
      } catch {
        // DMs closed, continue
      }

      const { success, label } = await this.executeModerationAction(
        interaction.guild,
        targetUser,
        bonkerUser,
        reason,
        action
      );

      const channelEmbed = new EmbedBuilder()
        .setColor(0xff00ff)
        .setDescription(
          success
            ? `${bonkerUser} super-mega-ultra-bonked ${targetUser} into oblivion! (${label})\n*${banReason}*`
            : `${bonkerUser} tried to super-mega-ultra-bonk ${targetUser} but it failed!`
        )
        .setImage('attachment://superbonk.png');

      return interaction.editReply({
        embeds: [channelEmbed],
        files: [attachment],
        allowedMentions: { users: [bonkerUser.id, targetUser.id] },
      });
    } catch (error) {
      this.container.logger.error('Failed to generate superbonk image:', error);

      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to generate the super bonk image.`,
      });
    }
  }

  /** Execute a moderation action through the mod system (creates case + logs to mod channel). */
  private async executeModerationAction(
    guild: Guild,
    target: User,
    moderator: User,
    reason: string,
    action: 'ban' | 'timeout'
  ): Promise<{ success: boolean; label: string }> {
    const label = action === 'timeout' ? 'timed out for 1m' : 'banned';
    const moderatorMember = await guild.members.fetch(moderator.id);

    const modContext = await buildModerationContext({
      guild,
      targetId: target.id,
      moderator,
      moderatorMember,
      reason,
      ...(action === 'timeout' && { duration: asDuration(60) }),
    });

    if (!modContext.success) return { success: false, label };

    const result =
      action === 'timeout'
        ? await executeTimeout(modContext.context)
        : await executeBan(modContext.context, false);

    return { success: result.success, label };
  }
}
