import { ModAction, CaseStatus, AppealStatus, MuteType } from '@prisma/client';
import type { Snowflake } from 'discord.js';

// Re-export Prisma enums as the single source of truth
export { ModAction, CaseStatus, AppealStatus, MuteType };

/**
 * Mapping from lowercase action strings to ModAction enum values.
 * Used by interaction listeners to convert user-selected actions.
 */
export const ACTION_TO_MOD_ACTION: Record<string, ModAction> = {
  warn: ModAction.WARN,
  kick: ModAction.KICK,
  ban: ModAction.BAN,
  softban: ModAction.SOFTBAN,
  timeout: ModAction.TIMEOUT,
  tempban: ModAction.TEMPBAN,
};

/**
 * Mapping from mute action strings to ModAction enum values.
 */
export const MUTE_ACTION_TO_MOD_ACTION: Record<string, ModAction> = {
  text: ModAction.MUTE_TEXT,
  voice: ModAction.MUTE_VOICE,
  both: ModAction.MUTE_BOTH,
};

/**
 * Branded type for Discord Snowflake IDs
 * This provides compile-time safety without runtime cost
 */
export type UserId = Snowflake & { readonly __brand: 'UserId' };
export type GuildId = Snowflake & { readonly __brand: 'GuildId' };
export type ChannelId = Snowflake & { readonly __brand: 'ChannelId' };
export type RoleId = Snowflake & { readonly __brand: 'RoleId' };
export type MessageId = Snowflake & { readonly __brand: 'MessageId' };

/**
 * Case ID is a positive integer unique per guild
 */
export type CaseNumber = number & { readonly __brand: 'CaseNumber' };

/**
 * Duration in seconds
 */
export type DurationSeconds = number & { readonly __brand: 'DurationSeconds' };

/**
 * Note ID (cuid)
 */
export type NoteId = string & { readonly __brand: 'NoteId' };

/**
 * Appeal ID (cuid)
 */
export type AppealId = string & { readonly __brand: 'AppealId' };

/**
 * Helper to create branded types from raw values
 */
export const asUserId = (id: string): UserId => id as UserId;
export const asGuildId = (id: string): GuildId => id as GuildId;
export const asChannelId = (id: string): ChannelId => id as ChannelId;
export const asRoleId = (id: string): RoleId => id as RoleId;
export const asMessageId = (id: string): MessageId => id as MessageId;
export const asCaseNumber = (n: number): CaseNumber => n as CaseNumber;
export const asDuration = (seconds: number): DurationSeconds => seconds as DurationSeconds;
export const asNoteId = (id: string): NoteId => id as NoteId;
export const asAppealId = (id: string): AppealId => id as AppealId;

/**
 * Input data for creating a moderation case
 */
export interface ModCaseInput {
  guildId: GuildId;
  action: ModAction;
  targetId: UserId;
  targetTag: string;
  moderatorId: UserId;
  moderatorTag: string;
  reason?: string;
  duration?: DurationSeconds;
  expiresAt?: Date;
}

/**
 * Input data for updating a case
 */
export interface ModCaseUpdateInput {
  reason?: string;
  status?: CaseStatus;
  evidence?: CaseEvidence;
}

/**
 * Evidence attached to a case
 */
export interface CaseEvidence {
  messageLinks?: string[];
  attachments?: string[];
  notes?: string;
}

/**
 * Input data for creating a mod note
 */
export interface ModNoteInput {
  guildId: GuildId;
  userId: UserId;
  createdById: UserId;
  note: string;
  tags?: string[];
}

/**
 * Input data for creating an appeal
 */
export interface ModAppealInput {
  guildId: GuildId;
  targetId: UserId;
  createdById: UserId;
  caseId?: string;
  reason: string;
}

/**
 * Input data for resolving an appeal
 */
export interface ModAppealResolveInput {
  resolution: string;
  resolvedById: UserId;
  status: AppealStatus;
}

/**
 * Result from canModerate check
 */
export interface ModerateCheckResult {
  canModerate: boolean;
  reason?: string;
}

/**
 * Info about a detected duplicate mod action
 */
export interface DedupInfo {
  /** The moderator who already performed this action */
  moderatorId: string;
  /** Display tag of that moderator */
  moderatorTag: string;
  /** When the original action was performed (epoch ms) */
  timestamp: number;
  /** A pending-override ID that can be used to confirm/override */
  pendingId?: string;
}

/**
 * Moderation action result
 */
export interface ModActionResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
  userNotified: boolean;
  /** Set when the action was blocked due to a recent duplicate */
  deduplicated?: DedupInfo;
}

/**
 * Moderation config per guild
 */
export interface ModerationConfig {
  modLogChannelId: ChannelId | null;
  muteRoleId: RoleId | null;
  mutedTextRole: RoleId | null;
  mutedVoiceRole: RoleId | null;
  muteSettings: MuteSettings;
  autoModEnabled: boolean;
  warningEscalation: WarningEscalationConfig;
}

/**
 * Mute settings configuration
 */
export interface MuteSettings {
  allowInThreads?: boolean;
  exemptChannels?: ChannelId[];
}

/**
 * Single escalation threshold
 */
export interface EscalationThreshold {
  count: number;
  action: 'timeout' | 'mute' | 'kick' | 'tempban';
  duration?: number; // seconds, for timeout/mute/tempban
  message?: string;
}

/**
 * Warning escalation configuration
 */
export interface WarningEscalationConfig {
  enabled: boolean;
  thresholds: EscalationThreshold[];
}

/**
 * Escalation recommendation
 */
export interface EscalationRecommendation {
  warningCount: number;
  recommendation: 'timeout' | 'mute' | 'kick' | 'tempban';
  reason: string;
  suggestedDuration?: number;
}

/**
 * Warning result with case and count
 */
export interface WarningResult extends ModActionResult {
  warningCount: number;
  escalation?: EscalationRecommendation;
}

/**
 * Time range for counting warnings
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Statistics for moderation in a guild
 */
export interface ModStats {
  total: number;
  bans: number;
  kicks: number;
  timeouts: number;
  warns: number;
  mutes: number;
}

/**
 * Mute ID (cuid)
 */
export type MuteId = string & { readonly __brand: 'MuteId' };
export const asMuteId = (id: string): MuteId => id as MuteId;

/**
 * Input data for creating a text mute
 */
export interface MuteTextInput {
  guildId: GuildId;
  userId: UserId;
  createdById: UserId;
  reason: string;
  duration?: DurationSeconds;
}

/**
 * Input data for creating a voice mute
 */
export interface MuteVoiceInput {
  guildId: GuildId;
  userId: UserId;
  createdById: UserId;
  reason: string;
  duration?: DurationSeconds;
}

/**
 * Input data for creating a combined mute (text + voice)
 */
export interface MuteBothInput {
  guildId: GuildId;
  userId: UserId;
  createdById: UserId;
  reason: string;
  duration?: DurationSeconds;
}

/**
 * Input data for unmute operations (unified for all unmute types)
 */
export interface UnmuteInput {
  guildId: GuildId;
  userId: UserId;
  moderatorId: UserId;
  moderatorTag: string;
  reason: string;
}

/**
 * Result from mute operations
 */
export interface MuteResult {
  success: boolean;
  muteId?: MuteId;
  caseNumber?: CaseNumber;
  error?: string;
  /** Set when the action was blocked due to a recent duplicate */
  deduplicated?: DedupInfo;
}

/**
 * Mute data returned from queries
 */
export interface MuteData {
  id: MuteId;
  guildId: string;
  userId: string;
  createdById: string;
  type: MuteType;
  reason: string;
  duration: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  active: boolean;
}

/**
 * Bulk action result
 */
export interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ userId: UserId; error: string }>;
}

// Type Guards

/**
 * Type guard for successful ModActionResult
 */
export function isModActionSuccess(
  result: ModActionResult
): result is ModActionResult & { success: true; caseNumber: CaseNumber } {
  return result.success === true && result.caseNumber !== undefined;
}

/**
 * Type guard for failed ModActionResult
 */
export function isModActionFailure(
  result: ModActionResult
): result is ModActionResult & { success: false; error: string } {
  return result.success === false;
}

/**
 * Type guard for successful MuteResult
 */
export function isMuteSuccess(
  result: MuteResult
): result is MuteResult & { success: true; caseNumber: CaseNumber } {
  return result.success === true && result.caseNumber !== undefined;
}

/**
 * Type guard for failed MuteResult
 */
export function isMuteFailure(
  result: MuteResult
): result is MuteResult & { success: false; error: string } {
  return result.success === false;
}
