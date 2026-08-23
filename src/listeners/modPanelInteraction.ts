import { Listener, container as sapphireContainer } from '@sapphire/framework';
import { Events, type Interaction, type ButtonInteraction, type GuildMember } from 'discord.js';
import {
  container,
  defer,
  editReply,
  errorMessage,
  ephemeralError,
  formModal,
  paragraphModal,
} from '#lib/discord/index.js';
import {
  isModPanelCustomId,
  decodeModPanelCustomId,
  ModPanelAction,
  encodeReasonModalCustomId,
  encodeDurationModalCustomId,
  encodeNoteModalCustomId,
  encodeMuteModalCustomId,
  isHistoryPaginationCustomId,
  decodeHistoryPaginationCustomId,
  getHistoryPaginationBase,
} from '#root/modules/moderation/discord/customId.js';
import { createHistoryEmbed } from '#root/modules/moderation/discord/embeds/presets.js';
import {
  buildModPanel,
  buildContextBundle,
  buildNotesList,
  modPanelActionToCommandKey,
  type ModPanelContext,
} from '#root/modules/moderation/discord/panelBuilder.js';
import { moderationService } from '#root/modules/moderation/services/ModerationService.js';
import { notesService } from '#root/modules/moderation/services/NotesService.js';
import { caseService } from '#root/modules/moderation/services/CaseService.js';
import { muteService } from '#root/modules/moderation/services/MuteService.js';
import { asGuildId, asUserId, CaseStatus } from '#root/modules/moderation/domain/types.js';
import { memoryLimiter } from '#lib/rateLimit/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { getAllowedModPanelActions } from '#lib/validation/permissionResolver.js';
import { isFail, type Gate } from '#lib/validation/Gate.js';
import { getGate } from '#lib/validation/gateContext.js';

const RATE_LIMIT_MS = 2000;

/** Actions that require hierarchy validation (punitive actions) */
const PUNITIVE_ACTIONS = new Set<string>([
  ModPanelAction.WARN,
  ModPanelAction.KICK,
  ModPanelAction.BAN,
  ModPanelAction.SOFTBAN,
  ModPanelAction.TIMEOUT,
  ModPanelAction.TEMPBAN,
  ModPanelAction.MUTE_TEXT,
  ModPanelAction.MUTE_VOICE,
  ModPanelAction.UNMUTE,
]);

/** Actions that require target to be a guild member */
const MEMBER_REQUIRED_ACTIONS = new Set<string>([
  ModPanelAction.WARN,
  ModPanelAction.KICK,
  ModPanelAction.TIMEOUT,
  ModPanelAction.MUTE_TEXT,
  ModPanelAction.MUTE_VOICE,
  ModPanelAction.UNMUTE,
]);

export class ModPanelInteractionListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.InteractionCreate,
    });
  }

  public async run(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.guildId) return;

    // Handle history pagination separately
    if (isHistoryPaginationCustomId(interaction.customId)) {
      await this.handleHistoryPagination(interaction);
      return;
    }

    if (!isModPanelCustomId(interaction.customId)) return;

    const parsed = decodeModPanelCustomId(interaction.customId);
    if (!parsed) {
      await interaction.reply(ephemeralError('Invalid interaction.'));
      return;
    }

    // Use shared Gate context (already initialized by 00-gateContext.ts)
    const gate = getGate(interaction);
    if (!gate) {
      await interaction.reply(ephemeralError('This can only be used in a server.'));
      return;
    }

    // Rate limit check
    const rateLimitKey = `modpanel:${interaction.user.id}:${parsed.action}`;
    const rateLimitResult = memoryLimiter.throttle(rateLimitKey, { minIntervalMs: RATE_LIMIT_MS });
    if (!rateLimitResult.allowed) {
      await interaction.reply(
        ephemeralError(
          `Please wait ${Math.ceil((rateLimitResult.retryAfterMs ?? RATE_LIMIT_MS) / 1000)}s before using this again.`
        )
      );
      return;
    }

    // Authorization check using Gate
    const commandKey = modPanelActionToCommandKey(parsed.action);
    const authResult = await gate.checkAuth(commandKey);
    if (isFail(authResult)) {
      await gate.deny(authResult);
      return;
    }

    const targetId = parsed.targetId;

    // For punitive actions, validate hierarchy before proceeding using Gate
    if (PUNITIVE_ACTIONS.has(parsed.action)) {
      const requiresMember = MEMBER_REQUIRED_ACTIONS.has(parsed.action);
      const targetMember = await gate.resolveMember(targetId);

      // Check if member is required but not found
      if (requiresMember && !targetMember) {
        await interaction.reply(ephemeralError('User is not in this server.'));
        return;
      }

      // Check hierarchy if we have a member
      if (targetMember) {
        const hierarchyResult = gate.checkHierarchy(targetMember);
        if (isFail(hierarchyResult)) {
          await gate.deny(hierarchyResult);
          return;
        }
      }
    }

    try {
      switch (parsed.action) {
        case ModPanelAction.WARN:
        case ModPanelAction.KICK:
        case ModPanelAction.BAN:
        case ModPanelAction.SOFTBAN:
          await this.showReasonModal(interaction, parsed.action, targetId);
          break;

        case ModPanelAction.TIMEOUT:
        case ModPanelAction.TEMPBAN:
          await this.showDurationModal(interaction, parsed.action, targetId);
          break;

        case ModPanelAction.MUTE_TEXT:
          await this.showMuteModal(interaction, 'text', targetId);
          break;

        case ModPanelAction.MUTE_VOICE:
          await this.showMuteModal(interaction, 'voice', targetId);
          break;

        case ModPanelAction.UNMUTE:
          await this.handleUnmute(interaction, targetId, gate);
          break;

        case ModPanelAction.ADD_NOTE:
          await this.showNoteModal(interaction, targetId);
          break;

        case ModPanelAction.VIEW_NOTES:
          await this.showNotes(interaction, targetId);
          break;

        case ModPanelAction.VIEW_CONTEXT:
          await this.showContext(interaction, targetId, gate);
          break;

        case ModPanelAction.VIEW_HISTORY:
          await this.showHistory(interaction, targetId);
          break;

        case ModPanelAction.REFRESH:
          await this.refreshPanel(interaction, targetId, gate);
          break;

        default:
          await interaction.reply(ephemeralError('Unknown action.'));
      }
    } catch (error) {
      sapphireContainer.logger.error('[ModPanelInteraction] Error handling interaction:', error);
      await interaction
        .reply(ephemeralError('An error occurred while processing your request.'))
        .catch(() => {});
    }
  }

  private async showMuteModal(
    interaction: ButtonInteraction,
    muteType: 'text' | 'voice',
    targetId: string
  ): Promise<void> {
    const modal = formModal(
      encodeMuteModalCustomId(muteType, targetId),
      `Mute User (${muteType === 'text' ? 'Text' : 'Voice'})`,
      [
        {
          id: 'duration',
          label: 'Duration (leave empty for permanent)',
          type: 'short',
          placeholder: '1h, 1d, 7d',
          required: false,
          maxLength: 10,
        },
        {
          id: 'reason',
          label: 'Reason',
          type: 'paragraph',
          placeholder: 'Enter the reason for this mute...',
          required: true,
          maxLength: 512,
        },
      ]
    );

    await interaction.showModal(modal);
  }

  private async handleUnmute(
    interaction: ButtonInteraction,
    targetId: string,
    gate: Gate
  ): Promise<void> {
    await defer(interaction);

    const guildId = asGuildId(gate.guild.id);
    const userId = asUserId(targetId);

    try {
      // Target and hierarchy already validated in run()
      const targetMember = await gate.guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) {
        await editReply(interaction, errorMessage('Error', 'User not found in this server.'));
        return;
      }

      const result = await muteService.unmuteBoth(gate.guild, targetMember, {
        guildId,
        userId,
        moderatorId: asUserId(interaction.user.id),
        moderatorTag: interaction.user.tag,
        reason: 'Unmuted via mod panel',
      });

      if (!result.success) {
        await editReply(
          interaction,
          errorMessage('Error', result.error ?? 'Failed to unmute user.')
        );
        return;
      }

      await editReply(
        interaction,
        container()
          .h2('User unmuted')
          .text(`**${targetMember.user.tag}** has been unmuted.`)
          .footer(`Case #${result.caseNumber}`)
      );
    } catch (error) {
      sapphireContainer.logger.error('[ModPanelInteraction] Error handling unmute:', error);
      await editReply(
        interaction,
        errorMessage('Error', 'An error occurred while processing the unmute.')
      );
    }
  }

  private async showReasonModal(
    interaction: ButtonInteraction,
    action: string,
    targetId: string
  ): Promise<void> {
    const modal = paragraphModal(
      encodeReasonModalCustomId(action as 'warn' | 'kick' | 'ban' | 'softban', targetId),
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      {
        customId: 'reason',
        label: 'Reason',
        placeholder: 'Enter the reason for this action...',
        required: true,
        maxLength: 512,
      }
    );

    await interaction.showModal(modal);
  }

  private async showDurationModal(
    interaction: ButtonInteraction,
    action: string,
    targetId: string
  ): Promise<void> {
    const modal = formModal(
      encodeDurationModalCustomId(action as 'timeout' | 'tempban', targetId),
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      [
        {
          id: 'duration',
          label: 'Duration (e.g., 10m, 1h, 1d)',
          type: 'short',
          placeholder: '1h',
          required: true,
          maxLength: 10,
        },
        {
          id: 'reason',
          label: 'Reason',
          type: 'paragraph',
          placeholder: 'Enter the reason for this action...',
          required: true,
          maxLength: 512,
        },
      ]
    );

    await interaction.showModal(modal);
  }

  private async showNoteModal(interaction: ButtonInteraction, targetId: string): Promise<void> {
    const modal = formModal(encodeNoteModalCustomId('add', targetId), 'Add Moderator Note', [
      {
        id: 'note',
        label: 'Note',
        type: 'paragraph',
        placeholder: 'Enter your note about this user...',
        required: true,
        maxLength: 1000,
      },
      {
        id: 'tags',
        label: 'Tags (comma-separated, optional)',
        type: 'short',
        placeholder: 'toxic, raid, spam',
        required: false,
        maxLength: 100,
      },
    ]);

    await interaction.showModal(modal);
  }

  private async showNotes(interaction: ButtonInteraction, targetId: string): Promise<void> {
    await defer(interaction);

    const guildId = asGuildId(
      ensureNonNull(interaction.guildId, 'modPanelInteraction > showNotes > guildId')
    );
    const userId = asUserId(targetId);

    const target = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      await editReply(interaction, errorMessage('Error', 'User not found.'));
      return;
    }

    const notes = await notesService.listNotes(guildId, userId);

    if (notes.length === 0) {
      await editReply(
        interaction,
        container().h3('No notes').text(`**${target.tag}** has no moderator notes.`)
      );
      return;
    }

    const notesList = buildNotesList(target, notes);
    await editReply(interaction, notesList);
  }

  private async showContext(
    interaction: ButtonInteraction,
    targetId: string,
    gate: Gate
  ): Promise<void> {
    await defer(interaction);

    const guildId = asGuildId(gate.guild.id);
    const userId = asUserId(targetId);

    const target = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      await editReply(interaction, errorMessage('Error', 'User not found.'));
      return;
    }

    let targetMember: GuildMember | null = null;
    try {
      targetMember = await gate.guild.members.fetch(targetId);
    } catch {
      // User may not be in the server
    }

    // Gather data for context
    const [userCases, notes, activeMutes] = await Promise.all([
      moderationService.getUserCases(guildId, userId),
      notesService.listNotes(guildId, userId),
      muteService.getActiveMutes(guildId, userId),
    ]);

    const recentCases = await caseService.getCasesByStatus(guildId, CaseStatus.OPEN);
    const userRecentCases = recentCases.filter((c) => c.targetId === targetId).slice(0, 5);

    const context: ModPanelContext = {
      target,
      targetMember,
      casesCount: userCases.length,
      notesCount: notes.length,
      recentCases: userRecentCases,
      recentNotes: notes.slice(0, 3),
      voiceChannelId: targetMember?.voice.channel?.id ?? null,
      joinedAt: targetMember?.joinedAt ?? null,
      accountCreatedAt: target.createdAt,
      hasActiveMutes: activeMutes.length > 0,
    };

    const contextBundle = buildContextBundle(context);
    await editReply(interaction, contextBundle);
  }

  private async showHistory(interaction: ButtonInteraction, targetId: string): Promise<void> {
    await defer(interaction);

    const guildId = asGuildId(
      ensureNonNull(interaction.guildId, 'modPanelInteraction > showHistory > guildId')
    );
    const userId = asUserId(targetId);
    const page = 1;

    const target = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      await editReply(interaction, errorMessage('Error', 'User not found.'));
      return;
    }

    const cases = await moderationService.getUserCases(guildId, userId);
    const historyEmbed = createHistoryEmbed(target, cases, {
      page,
      paginationCustomIdBase: getHistoryPaginationBase(targetId, page),
    });

    await editReply(interaction, historyEmbed);
  }

  private async refreshPanel(
    interaction: ButtonInteraction,
    targetId: string,
    gate: Gate
  ): Promise<void> {
    await interaction.deferUpdate();

    const guildId = asGuildId(gate.guild.id);
    const userId = asUserId(targetId);

    const target = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      await interaction.followUp(ephemeralError('User not found.'));
      return;
    }

    let targetMember: GuildMember | null = null;
    try {
      targetMember = await gate.guild.members.fetch(targetId);
    } catch {
      // User may not be in the server
    }

    const caller = gate.member;
    const [userCases, notes, activeMutes, allowedActions] = await Promise.all([
      moderationService.getUserCases(guildId, userId),
      notesService.listNotes(guildId, userId),
      muteService.getActiveMutes(guildId, userId),
      getAllowedModPanelActions(caller),
    ]);

    const recentCases = await caseService.getCasesByStatus(guildId, CaseStatus.OPEN);
    const userRecentCases = recentCases.filter((c) => c.targetId === targetId).slice(0, 5);

    const context: ModPanelContext = {
      target,
      targetMember,
      casesCount: userCases.length,
      notesCount: notes.length,
      recentCases: userRecentCases,
      recentNotes: notes.slice(0, 3),
      voiceChannelId: targetMember?.voice.channel?.id ?? null,
      joinedAt: targetMember?.joinedAt ?? null,
      accountCreatedAt: target.createdAt,
      hasActiveMutes: activeMutes.length > 0,
      allowedActions,
    };

    const containerComp = buildModPanel(context);
    await editReply(interaction, containerComp);
  }

  private async handleHistoryPagination(interaction: ButtonInteraction): Promise<void> {
    const decoded = decodeHistoryPaginationCustomId(interaction.customId);
    if (!decoded) {
      await interaction.reply(ephemeralError('Invalid pagination.'));
      return;
    }

    // Use shared Gate context and check authorization
    const gate = getGate(interaction);
    if (!gate || !(await gate.requireAuth('mod.history'))) {
      return;
    }

    // Calculate target page based on action
    let targetPage = decoded.page;
    if (decoded.action === 'prev') {
      targetPage = decoded.page - 1;
    } else if (decoded.action === 'next') {
      targetPage = decoded.page + 1;
    } else if (decoded.action === 'first') {
      targetPage = 1;
    } else if (decoded.action === 'info') {
      // Info button is disabled, shouldn't fire
      return;
    }
    // 'last' is handled by clamping below

    await interaction.deferUpdate();

    const guildId = asGuildId(
      ensureNonNull(interaction.guildId, 'handleHistoryPagination > guildId')
    );
    const userId = asUserId(decoded.targetId);

    const target = await interaction.client.users.fetch(decoded.targetId).catch(() => null);
    if (!target) {
      return;
    }

    const cases = await moderationService.getUserCases(guildId, userId);
    const totalPages = Math.ceil(cases.length / 5) || 1;

    // Handle 'last' action
    if (decoded.action === 'last') {
      targetPage = totalPages;
    }

    const clampedPage = Math.max(1, Math.min(targetPage, totalPages));

    const historyEmbed = createHistoryEmbed(target, cases, {
      page: clampedPage,
      paginationCustomIdBase: getHistoryPaginationBase(decoded.targetId, clampedPage),
    });

    await interaction.editReply({
      components: [historyEmbed.build()],
    });
  }
}
