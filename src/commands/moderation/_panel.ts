import type { Guild, GuildMember, User } from 'discord.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { notesService } from '../../modules/moderation/services/NotesService.js';
import { caseService } from '../../modules/moderation/services/CaseService.js';
import { muteService } from '../../modules/moderation/services/MuteService.js';
import {
  buildModPanel,
  type ModPanelContext,
} from '../../modules/moderation/discord/panelBuilder.js';
import { asGuildId, asUserId } from '../../modules/moderation/domain/types.js';
import { CaseStatus } from '@prisma/client';
import { errorMessage } from '#lib/discord/index.js';
import { getAllowedModPanelActions } from '#lib/validation/permissionResolver.js';

export interface PanelOptions {
  target: User;
  targetId: string;
  guild: Guild;
  guildId: string;
}

export async function handlePanel(options: PanelOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const guildId = asGuildId(options.guildId);
    const userId = asUserId(options.targetId);

    // Fetch target member
    let targetMember: GuildMember | null = null;
    try {
      targetMember = await options.guild.members.fetch(options.targetId);
    } catch {
      // User may not be in the server
    }

    // Gather context data in parallel
    const caller = ctx.member;
    const [userCases, notes, activeMutes, allowedActions] = await Promise.all([
      moderationService.getUserCases(guildId, userId),
      notesService.listNotes(guildId, userId),
      muteService.getActiveMutes(guildId, userId),
      getAllowedModPanelActions(caller),
    ]);

    // Get recent cases with extended data
    const recentCases = await caseService.getCasesByStatus(guildId, CaseStatus.OPEN);
    const userRecentCases = recentCases.filter((c) => c.targetId === options.target.id).slice(0, 5);

    // Build context
    const context: ModPanelContext = {
      target: options.target,
      targetMember,
      casesCount: userCases.length,
      notesCount: notes.length,
      recentCases: userRecentCases,
      recentNotes: notes.slice(0, 3),
      voiceChannelId: targetMember?.voice.channel?.id ?? null,
      joinedAt: targetMember?.joinedAt ?? null,
      accountCreatedAt: options.target.createdAt,
      hasActiveMutes: activeMutes.length > 0,
      allowedActions,
    };

    // Build the Components V2 panel
    const container = buildModPanel(context);

    await ctx.editReply(container);
  } catch (error) {
    ctx.client.logger.error('Error in panel command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while loading the mod panel.'))
      .catch(() => {});
  }
}
