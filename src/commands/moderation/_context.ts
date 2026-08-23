import type { Guild, GuildMember, User } from 'discord.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { notesService } from '../../modules/moderation/services/NotesService.js';
import { muteService } from '../../modules/moderation/services/MuteService.js';
import {
  buildContextBundle,
  type ModPanelContext,
} from '../../modules/moderation/discord/panelBuilder.js';
import {
  asGuildId,
  asUserId,
  type CaseNumber,
  type CaseEvidence,
} from '../../modules/moderation/domain/types.js';
import { errorMessage } from '#lib/discord/index.js';

export interface ContextOptions {
  target: User;
  targetId: string;
  guild: Guild;
  guildId: string;
  windowSeconds?: number;
}

export async function handleContext(options: ContextOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const guildId = asGuildId(options.guildId);
    const userId = asUserId(options.targetId);

    // Determine time window
    const windowMs = options.windowSeconds ? options.windowSeconds * 1000 : 24 * 60 * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);

    // Fetch target member
    let targetMember: GuildMember | null = null;
    try {
      targetMember = await options.guild.members.fetch(options.targetId);
    } catch {
      // User may not be in the server
    }

    // Gather context data in parallel
    const [userCases, notes, activeMutes] = await Promise.all([
      moderationService.getUserCases(guildId, userId),
      notesService.listNotes(guildId, userId),
      muteService.getActiveMutes(guildId, userId),
    ]);

    // Filter cases within window
    const recentCases = userCases
      .filter((c) => c.createdAt >= windowStart)
      .map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber as CaseNumber,
        guildId: c.guildId,
        action: c.action,
        targetId: c.targetId,
        targetTag: c.targetTag,
        moderatorId: c.moderatorId,
        moderatorTag: c.moderatorTag,
        reason: c.reason,
        duration: c.duration,
        status: c.status,
        evidence: c.evidence as CaseEvidence | null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        expiresAt: c.expiresAt,
      }));

    // Filter notes within window
    const recentNotes = notes.filter((n) => n.createdAt >= windowStart);

    // Build context
    const context: ModPanelContext = {
      target: options.target,
      targetMember,
      casesCount: userCases.length,
      notesCount: notes.length,
      recentCases: recentCases.slice(0, 10),
      recentNotes: recentNotes.slice(0, 5),
      voiceChannelId: targetMember?.voice.channel?.id ?? null,
      joinedAt: targetMember?.joinedAt ?? null,
      accountCreatedAt: options.target.createdAt,
      hasActiveMutes: activeMutes.length > 0,
    };

    // Build the Components V2 context bundle
    const container = buildContextBundle(context);

    await ctx.editReply(container);
  } catch (error) {
    ctx.client.logger.error('Error in context command:', error);
    await ctx
      .editReply(
        errorMessage('Error', 'An unexpected error occurred while loading the context bundle.')
      )
      .catch(() => {});
  }
}
