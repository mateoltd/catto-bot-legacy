import { type User, type GuildMember } from 'discord.js';
import { ModAction } from '@prisma/client';
import { voidStrike } from './embeds/presets.js';
import { encodeModPanelCustomId, ModPanelAction } from './customId.js';
import { getActionDisplay } from './modlog.js';
import {
  EMOJI,
  formatStatsLine,
  formatRelativeTimestamp,
  truncateText,
  userMention,
  safeTag,
  row,
  primaryButton,
  secondaryButton,
  dangerButton,
  successButton,
  type FluentContainer,
  container,
  primaryContainer,
  infoContainer,
  successContainer,
  errorContainer,
  warningContainer,
} from '#lib/discord/index.js';
import type { NoteData } from '../services/NotesService.js';
import type { ExtendedCaseData } from '../services/CaseService.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { CONFIG } from '#root/config.js';

/**
 * Context data for mod panel
 */
export interface ModPanelContext {
  target: User;
  targetMember: GuildMember | null;
  casesCount: number;
  notesCount: number;
  warningsCount?: number;
  recentCases: ExtendedCaseData[];
  recentNotes: NoteData[];
  voiceChannelId: string | null;
  joinedAt: Date | null;
  accountCreatedAt: Date;
  hasActiveMutes?: boolean;
  activeFlags?: string[];
  allowedActions?: Set<string>;
}

const MOD_PANEL_ACTION_MAP: Record<string, string> = {
  [ModPanelAction.WARN]: 'mod.warn',
  [ModPanelAction.KICK]: 'mod.kick',
  [ModPanelAction.BAN]: 'mod.ban',
  [ModPanelAction.SOFTBAN]: 'mod.softban',
  [ModPanelAction.TIMEOUT]: 'mod.timeout',
  [ModPanelAction.TEMPBAN]: 'mod.tempban',
  [ModPanelAction.MUTE_TEXT]: 'mod.mute.text',
  [ModPanelAction.MUTE_VOICE]: 'mod.mute.voice',
  [ModPanelAction.UNMUTE]: 'mod.unmute.both',
  [ModPanelAction.ADD_NOTE]: 'mod.note.add',
  [ModPanelAction.VIEW_NOTES]: 'mod.note.list',
  [ModPanelAction.VIEW_CONTEXT]: 'mod.context',
  [ModPanelAction.VIEW_HISTORY]: 'mod.history',
  [ModPanelAction.REFRESH]: 'mod.panel',
};

export function modPanelActionToCommandKey(action: string): string {
  return MOD_PANEL_ACTION_MAP[action] ?? 'mod.panel';
}

/**
 * Build the mod panel Components V2 message
 */
export function buildModPanel(context: ModPanelContext): FluentContainer {
  const {
    target,
    casesCount,
    notesCount,
    warningsCount,
    voiceChannelId,
    joinedAt,
    hasActiveMutes,
    activeFlags,
    allowedActions,
  } = context;
  const nonce = Math.random().toString(36).substring(2, 8);

  const isAllowed = (action: string): boolean => {
    if (!allowedActions) return true;
    const commandKey = MOD_PANEL_ACTION_MAP[action];
    return commandKey ? allowedActions.has(commandKey) : true;
  };

  // Header with optional flag indicator
  const flagIndicator =
    activeFlags && activeFlags.length > 0 ? ` ${EMOJI.MODERATION.STATE.SUSPICIOUS}` : '';

  // Stats for display
  const stats: Record<string, string | number> = {
    Cases: casesCount,
    Notes: notesCount,
  };
  if (warningsCount !== undefined) {
    stats['Warnings'] = warningsCount;
  }

  // Account info line
  const accountCreatedTs = formatRelativeTimestamp(target.createdAt);
  const accountLine = joinedAt
    ? `${EMOJI.USER.ACTIONS.INVITE} ${formatRelativeTimestamp(joinedAt)} · ${EMOJI.TIME.CLOCK} ${accountCreatedTs}`
    : `${EMOJI.TIME.CLOCK} ${accountCreatedTs}`;

  // Primary moderation actions row (filter by allowed)
  const primaryButtons = [];
  if (isAllowed(ModPanelAction.WARN)) {
    primaryButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.WARN, target.id, nonce),
        label: 'Warn',
      })
    );
  }
  if (isAllowed(ModPanelAction.TIMEOUT)) {
    primaryButtons.push(
      primaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.TIMEOUT, target.id, nonce),
        label: 'Timeout',
      })
    );
  }
  if (isAllowed(ModPanelAction.KICK)) {
    primaryButtons.push(
      dangerButton({
        customId: encodeModPanelCustomId(ModPanelAction.KICK, target.id, nonce),
        label: 'Kick',
      })
    );
  }
  if (isAllowed(ModPanelAction.BAN)) {
    primaryButtons.push(
      dangerButton({
        customId: encodeModPanelCustomId(ModPanelAction.BAN, target.id, nonce),
        label: 'Ban',
      })
    );
  }

  // Secondary actions row (filter by allowed)
  const secondaryButtons = [];
  if (isAllowed(ModPanelAction.MUTE_TEXT)) {
    secondaryButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.MUTE_TEXT, target.id, nonce),
        label: 'Mute Text',
      })
    );
  }
  if (isAllowed(ModPanelAction.MUTE_VOICE)) {
    secondaryButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.MUTE_VOICE, target.id, nonce),
        label: 'Mute Voice',
      })
    );
  }
  if (isAllowed(ModPanelAction.SOFTBAN)) {
    secondaryButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.SOFTBAN, target.id, nonce),
        label: 'Softban',
      })
    );
  }
  if (isAllowed(ModPanelAction.TEMPBAN)) {
    secondaryButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.TEMPBAN, target.id, nonce),
        label: 'Tempban',
      })
    );
  }
  if (hasActiveMutes && isAllowed(ModPanelAction.UNMUTE)) {
    secondaryButtons.push(
      successButton({
        customId: encodeModPanelCustomId(ModPanelAction.UNMUTE, target.id, nonce),
        label: 'Unmute',
      })
    );
  }

  // Info actions row (filter by allowed)
  const infoButtons = [];
  if (isAllowed(ModPanelAction.ADD_NOTE)) {
    infoButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.ADD_NOTE, target.id, nonce),
        label: 'Add Note',
      })
    );
  }
  if (isAllowed(ModPanelAction.VIEW_NOTES)) {
    infoButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.VIEW_NOTES, target.id, nonce),
        label: 'Notes',
      })
    );
  }
  if (isAllowed(ModPanelAction.VIEW_CONTEXT)) {
    infoButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.VIEW_CONTEXT, target.id, nonce),
        label: 'Context',
      })
    );
  }
  if (isAllowed(ModPanelAction.VIEW_HISTORY)) {
    infoButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.VIEW_HISTORY, target.id, nonce),
        label: 'History',
      })
    );
  }
  if (isAllowed(ModPanelAction.REFRESH)) {
    infoButtons.push(
      secondaryButton({
        customId: encodeModPanelCustomId(ModPanelAction.REFRESH, target.id, nonce),
        label: 'Refresh',
      })
    );
  }

  const result = primaryContainer()
    .h2(`${EMOJI.MODERATION.ICONS.SHIELD_BLUE} Mod Panel${flagIndicator}`)
    .text(`${EMOJI.USER.ICONS.MEMBER} ${safeTag(target.tag)} (\`${target.id}\`)`)
    .when(!!voiceChannelId, (c) =>
      c.text(
        `${EMOJI.VOICE.ICONS.GENERIC} <#${ensureNonNull(voiceChannelId, 'panelBuilder > buildModPanel(158): voiceChannelId')}>`
      )
    )
    .text(accountLine)
    .separator()
    .footer(formatStatsLine(stats));

  const actionRows = [];
  if (primaryButtons.length > 0) actionRows.push(row(...primaryButtons));
  if (secondaryButtons.length > 0) actionRows.push(row(...secondaryButtons));
  if (infoButtons.length > 0) actionRows.push(row(...infoButtons));

  if (actionRows.length > 0) {
    result.actions(...actionRows);
  }

  return result;
}

/**
 * Build a context bundle card using Components V2
 */
export function buildContextBundle(context: ModPanelContext): FluentContainer {
  const { target, recentCases, recentNotes, voiceChannelId, joinedAt, hasActiveMutes } = context;
  const nonce = Math.random().toString(36).substring(2, 8);

  // Build timeline entries
  const timeline: string[] = [`${EMOJI.TIME.CLOCK} ${formatRelativeTimestamp(target.createdAt)}`];
  if (joinedAt) {
    timeline.push(`${EMOJI.USER.ACTIONS.INVITE} ${formatRelativeTimestamp(joinedAt)}`);
  }
  if (voiceChannelId) {
    timeline.push(`${EMOJI.VOICE.ICONS.GENERIC} <#${voiceChannelId}>`);
  }

  // Format recent cases (using same style as createHistoryEmbed, no pagination)
  const recentCaseList = recentCases
    .slice(0, 5)
    .map((c) => {
      const display = getActionDisplay(c.action as ModAction);
      const timestamp = formatRelativeTimestamp(c.createdAt);
      const reasonPreview = c.reason ? truncateText(c.reason, 50) : 'No reason provided';
      const reasonDisplay = `\`${reasonPreview}\``;
      return `${display.emoji} **${voidStrike(`#${c.caseNumber} ${display.label}`, c.status)}** · ${timestamp}\n> \n${voidStrike(reasonDisplay, c.status)}`;
    })
    .join('\n');
  const casesText = recentCases.length > 0 ? `**Cases**\n${recentCaseList}` : 'No cases found.';

  // Format recent notes
  const notesText =
    recentNotes.length > 0
      ? recentNotes
          .slice(0, 3)
          .map((n) => {
            const timestamp = formatRelativeTimestamp(n.createdAt);
            const truncatedNote = truncateText(n.note, 100);
            return `${timestamp}: ${truncatedNote}`;
          })
          .join('\n')
      : null;

  // Quick actions
  const quickActions = row(
    primaryButton({
      customId: encodeModPanelCustomId(ModPanelAction.ADD_NOTE, target.id, nonce),
      label: 'Add Note',
    }),
    secondaryButton({
      customId: encodeModPanelCustomId(ModPanelAction.VIEW_HISTORY, target.id, nonce),
      label: 'Full History',
    }),
    secondaryButton({
      customId: encodeModPanelCustomId(ModPanelAction.VIEW_NOTES, target.id, nonce),
      label: 'All Notes',
    })
  );

  return infoContainer()
    .h2('Context Bundle')
    .text(
      `${EMOJI.USER.ICONS.MEMBER} ${safeTag(target.tag)} (${userMention(target.id)}) · \`${target.id}\``
    )
    .separator()
    .h2('Timeline')
    .text(timeline.join('\n'))
    .when(!!hasActiveMutes, (c) =>
      c
        .separator()
        .h2('Active statuses')
        .text(`${EMOJI.MODERATION.STATE.SUSPICIOUS} **Muted** (check /mod mutes for details)`)
    )
    .separator()
    .h2('Recent actions')
    .text(casesText)
    .when(!!notesText, (c) =>
      c
        .separator()
        .h2('Recent notes')
        .text(ensureNonNull(notesText, 'panelBuilder > buildContextBundle > notesText'))
    )
    .separator({ divider: true, spacing: 'small' })
    .actions(quickActions);
}

/**
 * Build a notes list using Components V2
 */
export function buildNotesList(
  target: User,
  notes: NoteData[],
  page: number = 1,
  pageSize: number = 5
): FluentContainer {
  const totalPages = Math.ceil(notes.length / pageSize) || 1;
  const startIdx = (page - 1) * pageSize;
  const pageNotes = notes.slice(startIdx, startIdx + pageSize);

  const c = container()
    .h2(`Notes for ${safeTag(target.tag)}`)
    .text(`Page ${page} of ${totalPages} (${notes.length} total)`)
    .separator();

  if (pageNotes.length === 0) {
    return c.text('*No notes found for this user.*');
  }

  for (const note of pageNotes) {
    const timestamp = formatRelativeTimestamp(note.createdAt);
    const tags =
      note.tags.length > 0 ? `\nTags: ${note.tags.map((t) => `\`${t}\``).join(', ')}` : '';
    c.text(`**ID:** \`${note.id}\`\n<@${note.createdById}> · ${timestamp}${tags}\n${note.note}`);
    c.separator();
  }

  return c;
}

/**
 * Build success message for mod action
 */
export function buildModActionSuccess(
  action: string,
  target: User | { id: string; tag: string },
  caseNumber: number,
  reason: string,
  duration?: string,
  options?: { dmSent?: boolean; guildId?: string; evidenceAttached?: boolean }
): FluentContainer {
  const targetTag = safeTag(target.tag);
  const details: Record<string, string> = {
    [`Target`]: `${targetTag} (\`${target.id}\`)`,
    [`Reason`]: reason,
  };

  const result = successContainer()
    .h2(`${EMOJI.STATUS.SUCCESS} ${action} successful`)
    .kv(details)
    .when(!!duration, (c) => c.text(`> ${EMOJI.MODERATION.ACTIONS.SLOWMODE} ${duration}`))
    .when(options?.dmSent === false, (c) =>
      c
        .separator({ divider: true, spacing: 'small' })
        .text(`${EMOJI.STATUS.WARNING} Could not send DM notification to user.`)
    )
    .when(!!options?.evidenceAttached, (c) => c.text(`> Evidence has been attached to this case.`))
    .footerWithTimestamp(`Case #${caseNumber}`);

  if (options?.guildId) {
    const evidenceUrl = `${CONFIG.DASHBOARD_URL}/mod/${options.guildId}/cases/${caseNumber}/evidence`;
    const label = options.evidenceAttached ? 'View Evidence' : 'Attach Evidence';
    result.linkButtons({ url: evidenceUrl, label, emoji: '📎' });
  }

  return result;
}

/**
 * Build error message with optional suggestion
 */
export function buildModActionError(error: string, suggestion?: string): FluentContainer {
  return errorContainer()
    .h2(`${EMOJI.STATUS.ERROR} Error`)
    .text(error)
    .when(!!suggestion, (c) =>
      c.separator().text(`${EMOJI.STATUS.INFO} **Suggestion:** ${suggestion}`)
    );
}

/**
 * Build a dedup warning message with a confirm override button.
 *
 * Shown when a moderator tries to perform an action that was already
 * executed by another moderator within the last ~2 minutes.
 *
 * @see https://github.com/your-org/catto/issues/114
 */
export function buildDedupWarning(
  action: ModAction,
  targetTag: string,
  existingModeratorTag: string,
  existingTimestamp: number,
  pendingId: string
): FluentContainer {
  const relativeTime = formatRelativeTimestamp(new Date(existingTimestamp));
  const display = getActionDisplay(action);

  return warningContainer()
    .h2(`${EMOJI.STATUS.WARNING} Duplicate Action Detected`)
    .text(
      `**${targetTag}** was already **${display.pastTense}** by **${existingModeratorTag}** ${relativeTime}.`
    )
    .text('If this is intentional, click **Confirm Override** to proceed anyway.')
    .confirmRow(`moddedup:v1:confirm:${pendingId}`, `moddedup:v1:cancel:${pendingId}`, {
      confirmLabel: 'Confirm Override',
      cancelLabel: 'Cancel',
      danger: true,
    });
}
