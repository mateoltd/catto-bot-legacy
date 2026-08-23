import { MuteType, ModAction } from '@prisma/client';
import type { Guild, User } from 'discord.js';
import { muteService } from '../../modules/moderation/services/MuteService.js';
import { logModAction, formatDuration } from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { MuteOptions, UnmuteOptions } from '#lib/interaction/typedOptions.js';
import { asUserId, asGuildId } from '../../modules/moderation/domain/types.js';
import { errorMessage, successMessage, safeTag } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import type { GuildId } from '../../modules/moderation/domain/types.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export interface MutesListOptions {
  target?: User;
  targetId?: string;
  muteType?: string;
  guild: Guild;
  guildId: GuildId;
}

/**
 * Handle /mod mute text
 */
export async function handleMuteText(options: MuteOptions, ctx: CommandResponder) {
  await ctx.defer();

  // Get Gate for hierarchy validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check bot permissions
    if (!options.guild.members.me?.permissions.has('ManageRoles')) {
      await ctx.editReply(errorMessage('Error', 'I do not have permission to manage roles.'));
      return;
    }

    // Check hierarchy using Gate
    const hierarchyResult = gate.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await ctx.editReply(hierarchyResult.response);
      return;
    }

    // Dedup check
    const dedupWarning = await commandDedupCheck({
      guild: options.guild,
      target: options.target,
      moderator: options.moderator,
      action: ModAction.MUTE_TEXT,
      reason: options.reason ?? 'No reason provided',
      duration: options.durationSeconds,
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    // Execute mute via service
    const result = await muteService.muteText(
      options.guild,
      targetMember,
      asUserId(ctx.user.id),
      ctx.user.tag,
      {
        guildId: asGuildId(options.guild.id),
        userId: asUserId(options.target.id),
        createdById: asUserId(ctx.user.id),
        reason: options.reason,
        duration: options.durationSeconds,
      }
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to mute the user.',
          'Check bot permissions and role hierarchy.'
        )
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.MUTE_TEXT,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_muteText > handleMuteText > logModAction(88): result.caseNumber'
      ),
      options.durationSeconds
    );

    const durationText = options.durationSeconds
      ? formatDuration(options.durationSeconds)
      : 'Permanent';

    await ctx.editReply(
      buildModActionSuccess(
        'Text mute',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_muteText > handleMuteText > buildModActionSuccess(101): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        durationText,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in mute text command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the mute.'))
      .catch(() => {});
  }
}

/**
 * Handle /mod mute voice
 */
export async function handleMuteVoice(options: MuteOptions, ctx: CommandResponder) {
  await ctx.defer();

  // Get Gate for hierarchy validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check bot permissions
    if (!options.guild.members.me?.permissions.has('DeafenMembers')) {
      await ctx.editReply(errorMessage('Error', 'I do not have permission to deafen members.'));
      return;
    }

    // Check hierarchy using Gate
    const hierarchyResult = gate.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await ctx.editReply(hierarchyResult.response);
      return;
    }

    // Dedup check
    const dedupWarningVoice = await commandDedupCheck({
      guild: options.guild,
      target: options.target,
      moderator: options.moderator,
      action: ModAction.MUTE_VOICE,
      reason: options.reason ?? 'No reason provided',
      duration: options.durationSeconds,
    });
    if (dedupWarningVoice) {
      await ctx.editReply(dedupWarningVoice);
      return;
    }

    // Execute mute via service
    const result = await muteService.muteVoice(
      options.guild,
      targetMember,
      asUserId(ctx.user.id),
      ctx.user.tag,
      {
        guildId: asGuildId(options.guild.id),
        userId: asUserId(options.target.id),
        createdById: asUserId(ctx.user.id),
        reason: options.reason,
        duration: options.durationSeconds,
      }
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(result.error ?? 'Failed to mute the user.', 'Check bot permissions.')
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.MUTE_VOICE,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_muteVoice > handleMuteVoice > logModAction(183): result.caseNumber'
      ),
      options.durationSeconds
    );

    const durationText = options.durationSeconds
      ? formatDuration(options.durationSeconds)
      : 'Permanent';

    await ctx.editReply(
      buildModActionSuccess(
        'Voice mute',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_muteVoice > handleMuteVoice > buildModActionSuccess(196): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        durationText,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in mute voice command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the mute.'))
      .catch(() => {});
  }
}

/**
 * Handle /mod mute both
 */
export async function handleMuteBoth(options: MuteOptions, ctx: CommandResponder) {
  await ctx.defer();

  // Get Gate for hierarchy validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check bot permissions
    if (
      !options.guild.members.me?.permissions.has('ManageRoles') ||
      !options.guild.members.me?.permissions.has('DeafenMembers')
    ) {
      await ctx.editReply(
        errorMessage('Error', 'I do not have permission to manage roles and deafen members.')
      );
      return;
    }

    // Check hierarchy using Gate
    const hierarchyResult = gate.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await ctx.editReply(hierarchyResult.response);
      return;
    }

    // Dedup check
    const dedupWarningBoth = await commandDedupCheck({
      guild: options.guild,
      target: options.target,
      moderator: options.moderator,
      action: ModAction.MUTE_BOTH,
      reason: options.reason ?? 'No reason provided',
      duration: options.durationSeconds,
    });
    if (dedupWarningBoth) {
      await ctx.editReply(dedupWarningBoth);
      return;
    }

    // Execute mute via service
    const result = await muteService.muteBoth(
      options.guild,
      targetMember,
      asUserId(ctx.user.id),
      ctx.user.tag,
      {
        guildId: asGuildId(options.guild.id),
        userId: asUserId(options.target.id),
        createdById: asUserId(ctx.user.id),
        reason: options.reason,
        duration: options.durationSeconds,
      }
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to mute the user.',
          'Check bot permissions and role hierarchy.'
        )
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.MUTE_BOTH,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_muteBoth > handleMuteBoth > logModAction(287): result.caseNumber'
      ),
      options.durationSeconds
    );

    const durationText = options.durationSeconds
      ? formatDuration(options.durationSeconds)
      : 'Permanent';

    await ctx.editReply(
      buildModActionSuccess(
        'Full mute',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_muteBoth > handleMuteBoth > buildModActionSuccess(300): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        durationText,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in mute both command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the mute.'))
      .catch(() => {});
  }
}

/**
 * Handle /mod unmute text
 */
export async function handleUnmuteText(options: UnmuteOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check if user has an active text mute
    const activeMutes = await muteService.getActiveMutes(
      asGuildId(options.guild.id),
      asUserId(options.target.id)
    );
    const hasTextMute = activeMutes.some(
      (m) => m.type === MuteType.TEXT || m.type === MuteType.BOTH
    );

    if (!hasTextMute) {
      await ctx.editReply(errorMessage('Error', 'User does not have an active text mute.'));
      return;
    }

    // Execute unmute via service
    const result = await muteService.unmuteText(options.guild, targetMember, {
      guildId: asGuildId(options.guild.id),
      userId: asUserId(options.target.id),
      moderatorId: asUserId(ctx.user.id),
      moderatorTag: ctx.user.tag,
      reason: options.reason ?? 'No reason provided',
    });

    if (!result.success) {
      await ctx.editReply(buildModActionError(result.error ?? 'Failed to unmute the user.'));
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.UNMUTE_TEXT,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_unmuteText > handleUnmuteText > logModAction(368): result.caseNumber'
      )
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Text unmute',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_unmuteText > handleUnmuteText > buildModActionSuccess(376): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        undefined,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in unmute text command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the unmute.'))
      .catch(() => {});
  }
}

/**
 * Handle /mod unmute voice
 */
export async function handleUnmuteVoice(options: UnmuteOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check if user has an active voice mute
    const activeMutes = await muteService.getActiveMutes(
      asGuildId(options.guild.id),
      asUserId(options.target.id)
    );
    const hasVoiceMute = activeMutes.some(
      (m) => m.type === MuteType.VOICE || m.type === MuteType.BOTH
    );

    if (!hasVoiceMute) {
      await ctx.editReply(errorMessage('Error', 'User does not have an active voice mute.'));
      return;
    }

    // Execute unmute via service
    const result = await muteService.unmuteVoice(options.guild, targetMember, {
      guildId: asGuildId(options.guild.id),
      userId: asUserId(options.target.id),
      moderatorId: asUserId(ctx.user.id),
      moderatorTag: ctx.user.tag,
      reason: options.reason ?? 'No reason provided',
    });

    if (!result.success) {
      await ctx.editReply(buildModActionError(result.error ?? 'Failed to unmute the user.'));
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.UNMUTE_VOICE,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_unmuteVoice > handleUnmuteVoice > logModAction(443): result.caseNumber'
      )
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Voice unmute',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_unmuteVoice > handleUnmuteVoice > buildModActionSuccess(451): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        undefined,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in unmute voice command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the unmute.'))
      .catch(() => {});
  }
}

/**
 * Handle /mod unmute both
 */
export async function handleUnmuteBoth(options: UnmuteOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check if user has any active mutes
    const activeMutes = await muteService.getActiveMutes(
      asGuildId(options.guild.id),
      asUserId(options.target.id)
    );

    if (activeMutes.length === 0) {
      await ctx.editReply(errorMessage('Error', 'User does not have any active mutes.'));
      return;
    }

    // Execute unmute via service
    const result = await muteService.unmuteBoth(options.guild, targetMember, {
      guildId: asGuildId(options.guild.id),
      userId: asUserId(options.target.id),
      moderatorId: asUserId(ctx.user.id),
      moderatorTag: ctx.user.tag,
      reason: options.reason ?? 'No reason provided',
    });

    if (!result.success) {
      await ctx.editReply(buildModActionError(result.error ?? 'Failed to unmute the user.'));
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.UNMUTE_BOTH,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_unmuteBoth > handleUnmuteBoth > logModAction(515): result.caseNumber'
      )
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Full unmute',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_unmuteBoth > handleUnmuteBoth > buildModActionSuccess(523): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        undefined,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in unmute both command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the unmute.'))
      .catch(() => {});
  }
}

/**
 * Handle /mod mutes list
 */
export async function handleMutesList(options: MutesListOptions, ctx: CommandResponder) {
  await ctx.defer();

  const typeStr = options.muteType as 'TEXT' | 'VOICE' | 'BOTH' | undefined;
  const type = typeStr ? MuteType[typeStr] : undefined;

  try {
    const guildId = asGuildId(options.guild.id);

    let mutes;
    if (options.target) {
      mutes = await muteService.getActiveMutes(guildId, asUserId(options.target.id));
      if (type) {
        mutes = mutes.filter((m) => m.type === type);
      }
    } else {
      mutes = await muteService.listActiveMutes(guildId, type);
    }

    if (mutes.length === 0) {
      const filterText = options.target ? ` for ${safeTag(options.target.tag)}` : '';
      const typeText = type ? ` of type ${type}` : '';
      await ctx.editReply(errorMessage('Error', `No active mutes found${filterText}${typeText}.`));
      return;
    }

    const muteLines = await Promise.all(
      mutes.slice(0, 20).map(async (m) => {
        const user = await ctx.client.users.fetch(m.userId).catch(() => null);
        const username = user?.tag ? safeTag(user.tag) : m.userId;
        const expiresText = m.expiresAt
          ? `expires <t:${Math.floor(m.expiresAt.getTime() / 1000)}:R>`
          : 'permanent';
        return `- **${username}** (${m.type}) - ${expiresText}\n  Reason: ${m.reason.substring(0, 100)}`;
      })
    );

    const title = options.target
      ? `Active mutes for ${safeTag(options.target.tag)}`
      : 'Active mutes';
    const remaining = mutes.length > 20 ? `\n*... and ${mutes.length - 20} more*` : '';

    await ctx.editReply(
      successMessage(`${title} (${mutes.length} total)`, `${muteLines.join('\n')}${remaining}`)
    );
  } catch (error) {
    ctx.client.logger.error('Error in mutes list command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while fetching mutes.'))
      .catch(() => {});
  }
}
