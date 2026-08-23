/**
 * Message/prefix command argument parsers.
 *
 * Each parser takes a guild-only Message and Sapphire Args instance and returns
 * the same typed options interface consumed by the shared command handlers,
 * bridging the gap between slash-command option parsing (typedOptions.ts) and
 * traditional prefix-based argument parsing.
 */

import type { Args } from '@sapphire/framework';
import { UserError, container } from '@sapphire/framework';
import type { Message, GuildMember, Guild, User, VoiceChannel, StageChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import {
  type BanOptions,
  type KickOptions,
  type TimeoutOptions,
  type WarnOptions,
  type UnbanOptions,
  type SoftbanOptions,
  type TempbanOptions,
  type CaseOptions,
  type HistoryOptions,
  type VoidOptions,
  type MuteOptions,
  type UnmuteOptions,
  type VoiceWhereOptions,
  type VoiceWatchOptions,
  type VoiceSnapshotOptions,
  type VoiceTrackOptions,
  parseDurationToSeconds,
} from './typedOptions.js';
import {
  type UserId,
  type GuildId,
  type DurationSeconds,
  asUserId,
  asGuildId,
  asChannelId,
} from '../../modules/moderation/domain/types.js';
import type { PanelOptions } from '../../commands/moderation/_panel.js';
import type { ContextOptions } from '../../commands/moderation/_context.js';
import type {
  NoteAddOptions,
  NoteListOptions,
  NoteDeleteOptions,
} from '../../commands/moderation/_note.js';
import type { EvidenceAddOptions } from '../../commands/moderation/_evidenceAdd.js';
import type { EvidenceListOptions } from '../../commands/moderation/_evidenceList.js';
import type { MutesListOptions } from '../../commands/moderation/_mute.js';
import type { SetupOptions } from '../../commands/moderation/_setup.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SNOWFLAKE_REGEX = /^\d{17,19}$/;

/**
 * Validate that a message originates from a guild and extract common context.
 */
function ensureGuildMessage(message: Message): {
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
} {
  if (!message.guild || !message.member) {
    throw new UserError({
      identifier: 'GuildOnly',
      message: 'This command can only be used in a server.',
    });
  }
  return {
    guild: message.guild,
    guildId: asGuildId(message.guild.id),
    moderator: message.author,
    moderatorMember: message.member as GuildMember,
  };
}

/**
 * Try to pick the remaining text as a string; returns the fallback on failure.
 */
async function restOrDefault(args: Args, fallback: string): Promise<string> {
  try {
    return await args.rest('string');
  } catch (err) {
    container.logger.debug('restOrDefault: no remaining args, using fallback:', err);
    return fallback;
  }
}

/**
 * Throw a UserError with a descriptive message for a missing/invalid argument.
 */
function missingArg(name: string, usage: string): never {
  throw new UserError({
    identifier: 'MissingArg',
    message: `Missing required argument: \`${name}\`. Usage: \`${usage}\``,
  });
}

/**
 * Parse a duration string through `parseDurationToSeconds`, throwing a
 * `UserError` if the value cannot be parsed.
 */
function requireDuration(raw: string): DurationSeconds {
  const seconds = parseDurationToSeconds(raw);
  if (!seconds) {
    throw new UserError({
      identifier: 'InvalidDuration',
      message: 'Invalid duration format. Use formats like: 10m, 1h, 1d, 7d',
    });
  }
  return seconds;
}

/**
 * Flexibly resolve a user from args. Tries in order:
 * 1. Sapphire's built-in user resolver (mentions, cached users)
 * 2. Raw string as a snowflake ID → client.users.fetch
 * 3. Raw string as a username → guild.members.fetch({ query })
 */
async function pickUserFlexible(args: Args, guild: Guild, usage: string): Promise<User> {
  // 1. Try mention/user resolver
  try {
    return await args.pick('user');
  } catch (err) {
    container.logger.debug('pickUserFlexible: user resolver failed, trying raw string:', err);
  }

  // 2. Try raw string
  let raw: string;
  try {
    raw = await args.pick('string');
  } catch (err) {
    container.logger.debug('pickUserFlexible: no string arg available:', err);
    missingArg('user', usage);
  }

  // 2a. If it looks like a snowflake, try fetching by ID
  if (SNOWFLAKE_REGEX.test(raw)) {
    try {
      return await guild.client.users.fetch(raw);
    } catch (err) {
      container.logger.debug(`pickUserFlexible: users.fetch failed for ID "${raw}":`, err);
    }
  }

  // 3. Fuzzy-match by username/display name
  try {
    const members = await guild.members.fetch({ query: raw, limit: 1 });
    const member = members.first();
    if (member) return member.user;
  } catch (err) {
    container.logger.warn(`pickUserFlexible: members.fetch query failed for "${raw}":`, err);
  }

  throw new UserError({
    identifier: 'InvalidUser',
    message: `Could not find user \`${raw}\`. Try a @mention, user ID, or exact username.`,
  });
}

/**
 * Try to resolve a user argument. Falls back to treating the next argument as
 * a raw snowflake ID when the user resolver fails (useful for banning users
 * who are not in the server), and finally tries username search.
 *
 * Returns `{ target, targetId }` where `target` may be `undefined` when only
 * a raw ID was provided.
 */
async function pickUserOrId(
  args: Args,
  guild: Guild,
  usage: string
): Promise<{ target?: User; targetId: UserId }> {
  // 1. Try mention/user resolver
  try {
    const user = await args.pick('user');
    return { target: user, targetId: asUserId(user.id) };
  } catch (err) {
    container.logger.debug('pickUserOrId: user resolver failed, trying raw string:', err);
  }

  let raw: string;
  try {
    raw = await args.pick('string');
  } catch (err) {
    container.logger.debug('pickUserOrId: no string arg available:', err);
    missingArg('user', usage);
  }

  // 2. Raw snowflake ID
  if (SNOWFLAKE_REGEX.test(raw)) {
    return { target: undefined, targetId: asUserId(raw) };
  }

  // 3. Fuzzy-match by username/display name
  try {
    const members = await guild.members.fetch({ query: raw, limit: 1 });
    const member = members.first();
    if (member) return { target: member.user, targetId: asUserId(member.id) };
  } catch (err) {
    container.logger.warn(`pickUserOrId: members.fetch query failed for "${raw}":`, err);
  }

  throw new UserError({
    identifier: 'InvalidUser',
    message: `Could not find user \`${raw}\`. Provide a @mention, user ID, or username.`,
  });
}

/**
 * Flexibly resolve a voice/stage channel from args. Tries:
 * 1. Sapphire's built-in channel resolver (#channel mention)
 * 2. Raw string as channel name via guild.channels.cache
 */
async function pickVoiceChannel(
  args: Args,
  guild: Guild,
  usage: string
): Promise<VoiceChannel | StageChannel> {
  // 1. Try channel mention resolver
  try {
    const channel = await args.pick('channel');
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
      return channel as VoiceChannel | StageChannel;
    }
    throw new UserError({
      identifier: 'InvalidChannel',
      message: 'Please specify a voice or stage channel.',
    });
  } catch (err) {
    // If it was our InvalidChannel error, rethrow
    if (err instanceof UserError && err.identifier === 'InvalidChannel') throw err;
    container.logger.debug('pickVoiceChannel: channel resolver failed, trying name search:', err);
  }

  // 2. Try raw string as channel name
  let raw: string;
  try {
    raw = await args.pick('string');
  } catch (err) {
    container.logger.debug('pickVoiceChannel: no string arg available:', err);
    missingArg('channel', usage);
  }

  const found = guild.channels.cache.find(
    (c) =>
      (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) &&
      c.name.toLowerCase() === raw.toLowerCase()
  );

  if (found) return found as VoiceChannel | StageChannel;

  throw new UserError({
    identifier: 'InvalidChannel',
    message: `Could not find voice channel \`${raw}\`. Use a #channel mention or exact channel name.`,
  });
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * `!ban <@user|userId> [reason]`
 *
 * Target may be a mention or a raw user ID (for banning users not in the
 * server). Reason defaults to "No reason provided". `deleteMessages` defaults
 * to `false`.
 */
export async function parseBanFromMessage(message: Message, args: Args): Promise<BanOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const { target, targetId } = await pickUserOrId(args, guild, '!ban <@user|userId> [reason]');
  const reason = await restOrDefault(args, 'No reason provided');

  return {
    target,
    targetId,
    reason,
    deleteMessages: false,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!kick <@user> [reason]`
 */
export async function parseKickFromMessage(message: Message, args: Args): Promise<KickOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!kick <@user> [reason]');
  const reason = await restOrDefault(args, 'No reason provided');

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!timeout <@user> <duration> [reason]`
 */
export async function parseTimeoutFromMessage(
  message: Message,
  args: Args
): Promise<TimeoutOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!timeout <@user> <duration> [reason]');

  const durationStr = await args.pick('string').catch(() => {
    missingArg('duration', '!timeout <@user> <duration> [reason]');
  });
  const durationSeconds = requireDuration(durationStr);
  const reason = await restOrDefault(args, 'No reason provided');

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    durationSeconds,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!warn <@user> <reason>`
 *
 * Reason is required for warnings.
 */
export async function parseWarnFromMessage(message: Message, args: Args): Promise<WarnOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!warn <@user> <reason>');

  const reason = await args.rest('string').catch(() => {
    missingArg('reason', '!warn <@user> <reason>');
  });

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!unban <userId> [reason]`
 *
 * Because banned users cannot be mentioned, only a raw snowflake ID is
 * accepted.
 */
export async function parseUnbanFromMessage(message: Message, args: Args): Promise<UnbanOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);

  const raw = await args.pick('string').catch(() => {
    missingArg('user_id', '!unban <userId> [reason]');
  });
  if (!SNOWFLAKE_REGEX.test(raw)) {
    throw new UserError({
      identifier: 'InvalidUserId',
      message: 'Invalid user ID format. User IDs are 17-19 digit numbers.',
    });
  }
  const reason = await restOrDefault(args, 'No reason provided');

  return {
    userId: asUserId(raw),
    reason,
    guild,
    guildId,
    moderator,
  };
}

/**
 * `!softban <@user|userId> [deleteDays] [reason]`
 *
 * `deleteDays` defaults to 7 if not provided or not a valid integer.
 */
export async function parseSoftbanFromMessage(
  message: Message,
  args: Args
): Promise<SoftbanOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const { target, targetId } = await pickUserOrId(
    args,
    guild,
    '!softban <@user|userId> [deleteDays] [reason]'
  );

  // Try to pick an integer for deleteDays; fall back to default.
  // Use save/restore to ensure the position rewinds on failure so the
  // word that was not an integer remains available for the reason.
  let deleteDays = 7;
  args.save();
  try {
    deleteDays = await args.pick('integer');
  } catch (err) {
    container.logger.debug('parseSoftban: no deleteDays integer, using default 7:', err);
    args.restore();
  }

  const reason = await restOrDefault(args, 'No reason provided');

  return {
    target,
    targetId,
    reason,
    deleteDays,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!tempban <@user|userId> <duration> [reason]`
 */
export async function parseTempbanFromMessage(
  message: Message,
  args: Args
): Promise<TempbanOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const { target, targetId } = await pickUserOrId(
    args,
    guild,
    '!tempban <@user|userId> <duration> [reason]'
  );

  const durationStr = await args.pick('string').catch(() => {
    missingArg('duration', '!tempban <@user|userId> <duration> [reason]');
  });
  const durationSeconds = requireDuration(durationStr);
  const reason = await restOrDefault(args, 'No reason provided');

  return {
    target,
    targetId,
    reason,
    durationSeconds,
    deleteMessages: false,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!case <number>`
 */
export async function parseCaseFromMessage(message: Message, args: Args): Promise<CaseOptions> {
  const { guild, guildId } = ensureGuildMessage(message);

  const caseNumber = await args.pick('integer').catch(() => {
    missingArg('number', '!case <number>');
  });

  return { caseNumber, guild, guildId };
}

/**
 * `!mod void <number> [reason]`
 */
export async function parseVoidFromMessage(message: Message, args: Args): Promise<VoidOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);

  const caseNumber = await args.pick('integer').catch(() => {
    missingArg('number', '!mod void <number> [reason]');
  });

  const reason = await restOrDefault(args, '').then((r) => r || undefined);

  return { caseNumber, reason, guild, guildId, moderator };
}

/**
 * `!history [@user]`
 *
 * If no user is provided, defaults to the message author.
 */
export async function parseHistoryFromMessage(
  message: Message,
  args: Args
): Promise<HistoryOptions> {
  const { guild, guildId } = ensureGuildMessage(message);

  let target: User;
  try {
    target = await pickUserFlexible(args, guild, '!history [@user]');
  } catch (err) {
    container.logger.debug('parseHistory: no user provided, defaulting to author:', err);
    target = message.author;
  }

  return {
    target,
    targetId: asUserId(target.id),
    guild,
    guildId,
  };
}

/**
 * `!mute [text|voice|both] <@user> [duration] <reason>`
 *
 * If the first word after the user mention parses as a valid duration it is
 * consumed as the optional duration; otherwise the entire remainder (including
 * that word) is treated as the reason.
 */
export async function parseMuteFromMessage(message: Message, args: Args): Promise<MuteOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const p = container.client.options.defaultPrefix ?? '!';
  const usage = `${p}mute [text|voice|both] <@user> [duration] <reason>`;
  const target = await pickUserFlexible(args, guild, usage);

  let durationSeconds: DurationSeconds | undefined;

  // Peek at the next word to check if it is a duration string.
  // If it parses as a valid duration, consume it; otherwise restore the
  // cursor so the word is included in the reason.
  args.save();
  try {
    const word = await args.pick('string');
    const parsed = parseDurationToSeconds(word);
    if (parsed) {
      durationSeconds = parsed;
    } else {
      // Not a duration — restore so it becomes part of the reason
      args.restore();
    }
  } catch (err) {
    container.logger.debug('parseMute: no duration arg available, skipping:', err);
    args.restore();
  }

  const reason = await args.rest('string').catch(() => {
    missingArg('reason', usage);
  });

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    durationSeconds,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

/**
 * `!unmute [text|voice|both] <@user> [reason]`
 */
export async function parseUnmuteFromMessage(message: Message, args: Args): Promise<UnmuteOptions> {
  const { guild, guildId, moderator, moderatorMember } = ensureGuildMessage(message);
  const p = container.client.options.defaultPrefix ?? '!';
  const target = await pickUserFlexible(
    args,
    guild,
    `${p}unmute [text|voice|both] <@user> [reason]`
  );
  const reason = await restOrDefault(args, 'No reason provided');

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    guild,
    guildId,
    moderator,
    moderatorMember,
  };
}

// ---------------------------------------------------------------------------
// Panel / Context
// ---------------------------------------------------------------------------

/**
 * `!panel <@user>`
 */
export async function parsePanelFromMessage(message: Message, args: Args): Promise<PanelOptions> {
  const { guild, guildId } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!panel <@user>');

  return {
    target,
    targetId: target.id,
    guild,
    guildId: guildId as string,
  };
}

/**
 * `!context <@user> [window]`
 *
 * The optional window is a duration string (e.g. "24h", "7d"). When omitted
 * the handler defaults to 24 hours.
 */
export async function parseContextFromMessage(
  message: Message,
  args: Args
): Promise<ContextOptions> {
  const { guild, guildId } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!context <@user> [window]');

  let windowSeconds: number | undefined;
  try {
    const raw = await args.pick('string');
    const parsed = parseDurationToSeconds(raw);
    if (parsed) {
      windowSeconds = parsed as number;
    }
  } catch (err) {
    container.logger.debug('parseContext: no window arg provided, using default:', err);
  }

  return {
    target,
    targetId: target.id,
    guild,
    guildId: guildId as string,
    windowSeconds,
  };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * `!mod note add <@user> <content>`
 */
export async function parseNoteAddFromMessage(
  message: Message,
  args: Args
): Promise<NoteAddOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!mod note add <@user> <content>');

  const content = await args.rest('string').catch(() => {
    missingArg('content', '!mod note add <@user> <content>');
  });

  return {
    target,
    targetId: target.id,
    content,
    guild,
    guildId: guildId as string,
    moderator,
  };
}

/**
 * `!mod note list <@user>`
 */
export async function parseNoteListFromMessage(
  message: Message,
  args: Args
): Promise<NoteListOptions> {
  const { guild, guildId } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!mod note list <@user>');

  return {
    target,
    targetId: target.id,
    guild,
    guildId: guildId as string,
  };
}

/**
 * `!mod note delete <noteId>`
 */
export async function parseNoteDeleteFromMessage(
  message: Message,
  args: Args
): Promise<NoteDeleteOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);

  const noteId = await args.pick('string').catch(() => {
    missingArg('note_id', '!mod note delete <noteId>');
  });

  return {
    noteId,
    guild,
    guildId: guildId as string,
    moderator,
  };
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * `!mod evidence add <caseNumber>`
 */
export async function parseEvidenceAddFromMessage(
  message: Message,
  args: Args
): Promise<EvidenceAddOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);

  const caseNumber = await args.pick('integer').catch(() => {
    missingArg('number', '!mod evidence add <number>');
  });

  return {
    caseNumber,
    guild,
    guildId: guildId as string,
    moderator,
  };
}

/**
 * `!mod evidence list <caseNumber>`
 */
export async function parseEvidenceListFromMessage(
  message: Message,
  args: Args
): Promise<EvidenceListOptions> {
  const { guild, guildId } = ensureGuildMessage(message);

  const caseNumber = await args.pick('integer').catch(() => {
    missingArg('number', '!mod evidence list <number>');
  });

  return {
    caseNumber,
    guild,
    guildId: guildId as string,
  };
}

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

/**
 * `!mod voice where <@user>`
 */
export async function parseVoiceWhereFromMessage(
  message: Message,
  args: Args
): Promise<VoiceWhereOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!mod voice where <@user>');

  return {
    target,
    targetId: asUserId(target.id),
    guild,
    guildId,
    moderator,
  };
}

/**
 * `!mod voice watch <@user> <duration>`
 */
export async function parseVoiceWatchFromMessage(
  message: Message,
  args: Args
): Promise<VoiceWatchOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);
  const target = await pickUserFlexible(args, guild, '!mod voice watch <@user> <duration>');

  const durationStr = await args.pick('string').catch(() => {
    missingArg('duration', '!mod voice watch <@user> <duration>');
  });
  const durationSeconds = requireDuration(durationStr);

  return {
    target,
    targetId: asUserId(target.id),
    durationSeconds,
    guild,
    guildId,
    moderator,
  };
}

/**
 * `!mod voice snapshot <#channel>`
 *
 * Picks a channel argument and validates that it is a voice or stage channel.
 * Falls back to resolving by channel name if a #mention isn't provided.
 */
export async function parseVoiceSnapshotFromMessage(
  message: Message,
  args: Args
): Promise<VoiceSnapshotOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);
  const channel = await pickVoiceChannel(args, guild, '!mod voice snapshot <#channel>');

  return {
    channel,
    channelId: asChannelId(channel.id),
    guild,
    guildId,
    moderator,
  };
}

/**
 * `!mod voice track <#channel> <duration>`
 */
export async function parseVoiceTrackFromMessage(
  message: Message,
  args: Args
): Promise<VoiceTrackOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);
  const channel = await pickVoiceChannel(args, guild, '!mod voice track <#channel> <duration>');

  const durationStr = await args.pick('string').catch(() => {
    missingArg('duration', '!mod voice track <#channel> <duration>');
  });
  const durationSeconds = requireDuration(durationStr);

  return {
    channel,
    channelId: asChannelId(channel.id),
    durationSeconds,
    guild,
    guildId,
    moderator,
  };
}

// ---------------------------------------------------------------------------
// Mutes list
// ---------------------------------------------------------------------------

/**
 * `!mod mutes [@user] [type]`
 *
 * Both arguments are optional. `type` can be "text", "voice", or "both".
 */
export async function parseMutesListFromMessage(
  message: Message,
  args: Args
): Promise<MutesListOptions> {
  const { guild, guildId } = ensureGuildMessage(message);

  let target: User | undefined;
  let targetId: string | undefined;
  try {
    target = await args.pick('user');
    targetId = target.id;
  } catch (err) {
    container.logger.debug('parseMutesList: no user filter provided:', err);
  }

  let muteType: string | undefined;
  try {
    const raw = await args.pick('string');
    const upper = raw.toUpperCase();
    if (['TEXT', 'VOICE', 'BOTH'].includes(upper)) {
      muteType = upper;
    }
  } catch (err) {
    container.logger.debug('parseMutesList: no type filter provided:', err);
  }

  return {
    target,
    targetId,
    muteType,
    guild,
    guildId,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * `!mod setup` (no arguments)
 */
export async function parseSetupFromMessage(message: Message, _args: Args): Promise<SetupOptions> {
  const { guild, guildId, moderator } = ensureGuildMessage(message);

  return {
    guild,
    guildId: guildId as string,
    moderator,
  };
}
