import type {
  ChatInputCommandInteraction,
  GuildMember,
  User,
  Guild,
  VoiceChannel,
  StageChannel,
} from 'discord.js';
import { ChannelType } from 'discord.js';
import {
  snowflakeSchema,
  durationStringSchema,
  safeParse,
  ValidationError,
} from '#lib/validation/zod.js';
import {
  type UserId,
  type GuildId,
  type ChannelId,
  type DurationSeconds,
  asUserId,
  asGuildId,
  asChannelId,
  asDuration,
} from '../../modules/moderation/domain/types.js';
import { ensureNonNull } from '../utils.js';

/**
 * Parsed ban options from interaction
 */
export interface BanOptions {
  /** Target user object (only available if user is resolvable) */
  target?: User;
  /** Target user ID (always available) */
  targetId: UserId;
  reason: string;
  deleteMessages: boolean;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed kick options from interaction
 */
export interface KickOptions {
  target: User;
  targetId: UserId;
  reason: string;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed timeout options from interaction
 */
export interface TimeoutOptions {
  target: User;
  targetId: UserId;
  reason: string;
  durationSeconds: DurationSeconds;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed warn options from interaction
 */
export interface WarnOptions {
  target: User;
  targetId: UserId;
  reason: string;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed unban options from interaction
 */
export interface UnbanOptions {
  userId: UserId;
  reason: string;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
}

/**
 * Parsed softban options from interaction
 */
export interface SoftbanOptions {
  /** Target user object (only available if user is resolvable) */
  target?: User;
  /** Target user ID (always available) */
  targetId: UserId;
  reason: string;
  deleteDays: number;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed tempban options from interaction
 */
export interface TempbanOptions {
  /** Target user object (only available if user is resolvable) */
  target?: User;
  /** Target user ID (always available) */
  targetId: UserId;
  reason: string;
  durationSeconds: DurationSeconds;
  deleteMessages: boolean;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed case options from interaction
 */
export interface CaseOptions {
  caseNumber: number;
  guild: Guild;
  guildId: GuildId;
}

/**
 * Parsed void options from interaction
 */
export interface VoidOptions {
  caseNumber: number;
  reason?: string;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
}

/**
 * Parsed history options from interaction
 */
export interface HistoryOptions {
  target: User;
  targetId: UserId;
  guild: Guild;
  guildId: GuildId;
}

/**
 * Parse duration string to seconds
 */
export function parseDurationToSeconds(durationStr: string): DurationSeconds | null {
  const regex = /(\d+)([smhdw])/g;
  let total = 0;
  let match;

  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1] ?? '0', 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        total += value;
        break;
      case 'm':
        total += value * 60;
        break;
      case 'h':
        total += value * 3600;
        break;
      case 'd':
        total += value * 86400;
        break;
      case 'w':
        total += value * 604800;
        break;
    }
  }

  return total > 0 ? asDuration(total) : null;
}

/**
 * Ensure interaction is in a guild context
 */
function ensureGuildContext(interaction: ChatInputCommandInteraction): {
  guild: Guild;
  guildId: GuildId;
  moderatorMember: GuildMember;
} {
  if (!interaction.guild || !interaction.member) {
    throw new ValidationError('This command can only be used in a server.');
  }
  return {
    guild: interaction.guild,
    guildId: asGuildId(interaction.guild.id),
    moderatorMember: interaction.member as GuildMember,
  };
}

/**
 * Parse ban subcommand options
 * Accepts either `target` (user mention) or `target_id` (string ID)
 */
export function parseBanOptions(interaction: ChatInputCommandInteraction): BanOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target');
  const targetIdStr = interaction.options.getString('target_id');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const deleteMessages = interaction.options.getBoolean('delete_messages') ?? false;

  // Require at least one of target or target_id
  if (!target && !targetIdStr) {
    throw new ValidationError(
      'You must provide either a target user or a target_id. Use target_id for users not in the server.'
    );
  }

  // Validate target_id if provided
  let targetId: UserId;
  if (targetIdStr) {
    const validation = safeParse(snowflakeSchema, targetIdStr);
    if (!validation.success) {
      throw new ValidationError('Invalid user ID format. User IDs are 17-20 digit numbers.');
    }
    targetId = asUserId(targetIdStr);
  } else {
    targetId = asUserId(ensureNonNull(target, 'typedOptions > parseBanOptions(227): target').id);
  }

  return {
    target: target ?? undefined,
    targetId,
    reason,
    deleteMessages,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

/**
 * Parse kick subcommand options
 */
export function parseKickOptions(interaction: ChatInputCommandInteraction): KickOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

/**
 * Parse timeout subcommand options
 * @throws {ValidationError} If duration format is invalid
 */
export function parseTimeoutOptions(interaction: ChatInputCommandInteraction): TimeoutOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  const validation = safeParse(durationStringSchema, durationStr);
  if (!validation.success) {
    throw new ValidationError('Invalid duration format. Use formats like: 10m, 1h, 1d, 7d');
  }

  const durationSeconds = parseDurationToSeconds(durationStr);
  if (!durationSeconds) {
    throw new ValidationError('Invalid duration format. Use formats like: 10m, 1h, 1d, 7d');
  }

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    durationSeconds,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

/**
 * Parse warn subcommand options
 */
export function parseWarnOptions(interaction: ChatInputCommandInteraction): WarnOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason', true);

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

/**
 * Parse unban subcommand options
 * @throws {ValidationError} If user ID format is invalid
 */
export function parseUnbanOptions(interaction: ChatInputCommandInteraction): UnbanOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const userId = interaction.options.getString('user_id', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  const validation = safeParse(snowflakeSchema, userId);
  if (!validation.success) {
    throw new ValidationError('Invalid user ID format. User IDs are 17-20 digit numbers.');
  }

  return {
    userId: asUserId(userId),
    reason,
    guild,
    guildId,
    moderator: interaction.user,
  };
}

/**
 * Parse case subcommand options
 */
export function parseCaseOptions(interaction: ChatInputCommandInteraction): CaseOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const caseNumber = interaction.options.getInteger('number', true);

  return {
    caseNumber,
    guild,
    guildId,
  };
}

/**
 * Parse void subcommand options
 */
export function parseVoidOptions(interaction: ChatInputCommandInteraction): VoidOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const caseNumber = interaction.options.getInteger('number', true);
  const reason = interaction.options.getString('reason') ?? undefined;

  return {
    caseNumber,
    reason,
    guild,
    guildId,
    moderator: interaction.user,
  };
}

/**
 * Parse history subcommand options
 */
export function parseHistoryOptions(interaction: ChatInputCommandInteraction): HistoryOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);

  return {
    target,
    targetId: asUserId(target.id),
    guild,
    guildId,
  };
}

/**
 * Parse softban subcommand options
 * Accepts either `target` (user mention) or `target_id` (string ID)
 */
export function parseSoftbanOptions(interaction: ChatInputCommandInteraction): SoftbanOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target');
  const targetIdStr = interaction.options.getString('target_id');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const deleteDays = interaction.options.getInteger('delete_days') ?? 7;

  // Require at least one of target or target_id
  if (!target && !targetIdStr) {
    throw new ValidationError(
      'You must provide either a target user or a target_id. Use target_id for users not in the server.'
    );
  }

  // Validate target_id if provided
  let targetId: UserId;
  if (targetIdStr) {
    const validation = safeParse(snowflakeSchema, targetIdStr);
    if (!validation.success) {
      throw new ValidationError('Invalid user ID format. User IDs are 17-20 digit numbers.');
    }
    targetId = asUserId(targetIdStr);
  } else {
    targetId = asUserId(
      ensureNonNull(target, 'typedOptions > parseSoftbanOptions(398): target').id
    );
  }

  return {
    target: target ?? undefined,
    targetId,
    reason,
    deleteDays,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

/**
 * Parse tempban subcommand options
 * Accepts either `target` (user mention) or `target_id` (string ID)
 * @throws {ValidationError} If target/duration format is invalid
 */
export function parseTempbanOptions(interaction: ChatInputCommandInteraction): TempbanOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target');
  const targetIdStr = interaction.options.getString('target_id');
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const deleteMessages = interaction.options.getBoolean('delete_messages') ?? false;

  // Require at least one of target or target_id
  if (!target && !targetIdStr) {
    throw new ValidationError(
      'You must provide either a target user or a target_id. Use target_id for users not in the server.'
    );
  }

  // Validate target_id if provided
  let targetId: UserId;
  if (targetIdStr) {
    const validation = safeParse(snowflakeSchema, targetIdStr);
    if (!validation.success) {
      throw new ValidationError('Invalid user ID format. User IDs are 17-20 digit numbers.');
    }
    targetId = asUserId(targetIdStr);
  } else {
    targetId = asUserId(
      ensureNonNull(target, 'typedOptions > parseTempbanOptions(444): target').id
    );
  }

  // Validate and parse duration
  const durationValidation = safeParse(durationStringSchema, durationStr);
  if (!durationValidation.success) {
    throw new ValidationError('Invalid duration format. Use formats like: 10m, 1h, 1d, 7d');
  }

  const durationSeconds = parseDurationToSeconds(durationStr);
  if (!durationSeconds) {
    throw new ValidationError('Invalid duration format. Use formats like: 10m, 1h, 1d, 7d');
  }

  return {
    target: target ?? undefined,
    targetId,
    reason,
    durationSeconds,
    deleteMessages,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

// ==================== Voice Command Options ====================

/**
 * Parsed voice where options
 */
export interface VoiceWhereOptions {
  target: User;
  targetId: UserId;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
}

/**
 * Parsed voice watch options
 */
export interface VoiceWatchOptions {
  target: User;
  targetId: UserId;
  durationSeconds: DurationSeconds;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
}

/**
 * Parsed voice snapshot options
 */
export interface VoiceSnapshotOptions {
  channel: VoiceChannel | StageChannel;
  channelId: ChannelId;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
}

/**
 * Parsed voice track options
 */
export interface VoiceTrackOptions {
  channel: VoiceChannel | StageChannel;
  channelId: ChannelId;
  durationSeconds: DurationSeconds;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
}

/**
 * Parse voice where subcommand options
 */
export function parseVoiceWhereOptions(
  interaction: ChatInputCommandInteraction
): VoiceWhereOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);

  return {
    target,
    targetId: asUserId(target.id),
    guild,
    guildId,
    moderator: interaction.user,
  };
}

/**
 * Parse voice watch subcommand options
 * @throws {ValidationError} If duration format is invalid
 */
export function parseVoiceWatchOptions(
  interaction: ChatInputCommandInteraction
): VoiceWatchOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);
  const durationStr = interaction.options.getString('duration', true);

  const validation = safeParse(durationStringSchema, durationStr);
  if (!validation.success) {
    throw new ValidationError('Invalid duration format. Use formats like: 1m, 5m, 10m, 15m');
  }

  const durationSeconds = parseDurationToSeconds(durationStr);
  if (!durationSeconds) {
    throw new ValidationError('Invalid duration format. Use formats like: 1m, 5m, 10m, 15m');
  }

  return {
    target,
    targetId: asUserId(target.id),
    durationSeconds,
    guild,
    guildId,
    moderator: interaction.user,
  };
}

/**
 * Parse voice snapshot subcommand options
 * @throws {ValidationError} If channel is not a voice channel
 */
export function parseVoiceSnapshotOptions(
  interaction: ChatInputCommandInteraction
): VoiceSnapshotOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const channel = interaction.options.getChannel('channel', true);

  // Check if channel is voice-based by type
  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
    throw new ValidationError('Please select a voice or stage channel.');
  }

  // Fetch the actual channel from the guild cache
  const voiceChannel = guild.channels.cache.get(channel.id);
  if (!voiceChannel || !voiceChannel.isVoiceBased()) {
    throw new ValidationError('Could not find the voice channel.');
  }

  return {
    channel: voiceChannel as VoiceChannel | StageChannel,
    channelId: asChannelId(channel.id),
    guild,
    guildId,
    moderator: interaction.user,
  };
}

/**
 * Parse voice track subcommand options
 * @throws {ValidationError} If channel or duration is invalid
 */
export function parseVoiceTrackOptions(
  interaction: ChatInputCommandInteraction
): VoiceTrackOptions {
  const { guild, guildId } = ensureGuildContext(interaction);

  const channel = interaction.options.getChannel('channel', true);
  const durationStr = interaction.options.getString('duration', true);

  // Check if channel is voice-based by type
  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
    throw new ValidationError('Please select a voice or stage channel.');
  }

  // Fetch the actual channel from the guild cache
  const voiceChannel = guild.channels.cache.get(channel.id);
  if (!voiceChannel || !voiceChannel.isVoiceBased()) {
    throw new ValidationError('Could not find the voice channel.');
  }

  const validation = safeParse(durationStringSchema, durationStr);
  if (!validation.success) {
    throw new ValidationError('Invalid duration format. Use formats like: 1m, 5m, 10m, 15m');
  }

  const durationSeconds = parseDurationToSeconds(durationStr);
  if (!durationSeconds) {
    throw new ValidationError('Invalid duration format. Use formats like: 1m, 5m, 10m, 15m');
  }

  return {
    channel: voiceChannel as VoiceChannel | StageChannel,
    channelId: asChannelId(channel.id),
    durationSeconds,
    guild,
    guildId,
    moderator: interaction.user,
  };
}

// ==================== Mute Command Options ====================

/**
 * Parsed mute options
 */
export interface MuteOptions {
  target: User;
  targetId: UserId;
  reason: string;
  durationSeconds?: DurationSeconds;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parsed unmute options
 */
export interface UnmuteOptions {
  target: User;
  targetId: UserId;
  reason: string;
  guild: Guild;
  guildId: GuildId;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Parse mute subcommand options (with optional duration)
 * @throws {ValidationError} If duration format is invalid
 */
export function parseMuteOptions(interaction: ChatInputCommandInteraction): MuteOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason', true);
  const durationStr = interaction.options.getString('duration');

  let durationSeconds: DurationSeconds | undefined;
  if (durationStr) {
    const validation = safeParse(durationStringSchema, durationStr);
    if (!validation.success) {
      throw new ValidationError('Invalid duration format. Use formats like: 10m, 1h, 1d, 7d');
    }
    durationSeconds = parseDurationToSeconds(durationStr) ?? undefined;
  }

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    durationSeconds,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}

/**
 * Parse unmute subcommand options
 */
export function parseUnmuteOptions(interaction: ChatInputCommandInteraction): UnmuteOptions {
  const { guild, guildId, moderatorMember } = ensureGuildContext(interaction);

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  return {
    target,
    targetId: asUserId(target.id),
    reason,
    guild,
    guildId,
    moderator: interaction.user,
    moderatorMember,
  };
}
