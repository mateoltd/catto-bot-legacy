import { z } from 'zod';
import { snowflakeSchema } from '#lib/validation/zod.js';

/**
 * Version for the custom_id encoding format
 * Increment if format changes to support backward compatibility
 */
const CUSTOM_ID_VERSION = 'v1';

/**
 * Available mod panel actions
 */
export const ModPanelAction = {
  WARN: 'warn',
  TIMEOUT: 'timeout',
  KICK: 'kick',
  BAN: 'ban',
  SOFTBAN: 'softban',
  TEMPBAN: 'tempban',
  ADD_NOTE: 'addnote',
  VIEW_NOTES: 'viewnotes',
  VIEW_CONTEXT: 'viewctx',
  VIEW_HISTORY: 'history',
  REFRESH: 'refresh',
  MUTE_TEXT: 'mutetxt',
  MUTE_VOICE: 'mutevoice',
  UNMUTE: 'unmute',
} as const;

export type ModPanelActionType = (typeof ModPanelAction)[keyof typeof ModPanelAction];

/**
 * Schema for mod panel custom_id
 * Format: modpanel:v1:{action}:{targetId}:{nonce}
 */
export const ModPanelCustomIdSchema = z.object({
  prefix: z.literal('modpanel'),
  version: z.literal(CUSTOM_ID_VERSION),
  action: z.enum([
    ModPanelAction.WARN,
    ModPanelAction.TIMEOUT,
    ModPanelAction.KICK,
    ModPanelAction.BAN,
    ModPanelAction.SOFTBAN,
    ModPanelAction.TEMPBAN,
    ModPanelAction.ADD_NOTE,
    ModPanelAction.VIEW_NOTES,
    ModPanelAction.VIEW_CONTEXT,
    ModPanelAction.VIEW_HISTORY,
    ModPanelAction.REFRESH,
    ModPanelAction.MUTE_TEXT,
    ModPanelAction.MUTE_VOICE,
    ModPanelAction.UNMUTE,
  ]),
  targetId: snowflakeSchema,
  nonce: z.string().min(1),
});

export type ModPanelCustomId = z.infer<typeof ModPanelCustomIdSchema>;

/**
 * Encode a mod panel custom_id
 */
export function encodeModPanelCustomId(
  action: ModPanelActionType,
  targetId: string,
  nonce?: string
): string {
  const safeNonce = nonce ?? generateNonce();
  return `modpanel:${CUSTOM_ID_VERSION}:${action}:${targetId}:${safeNonce}`;
}

/**
 * Decode and validate a mod panel custom_id
 */
export function decodeModPanelCustomId(customId: string): ModPanelCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 5) {
    return null;
  }

  const [prefix, version, action, targetId, nonce] = parts;

  const result = ModPanelCustomIdSchema.safeParse({
    prefix,
    version,
    action,
    targetId,
    nonce,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

/**
 * Check if a custom_id is a mod panel interaction
 */
export function isModPanelCustomId(customId: string): boolean {
  return customId.startsWith(`modpanel:${CUSTOM_ID_VERSION}:`);
}

/**
 * Generate a short random nonce
 */
function generateNonce(): string {
  return Math.random().toString(36).substring(2, 8);
}

// ==================== Note Modal Custom ID ====================

/**
 * Schema for note modal custom_id
 * Format: modnote:v1:{action}:{targetId}
 */
export const NoteModalCustomIdSchema = z.object({
  prefix: z.literal('modnote'),
  version: z.literal(CUSTOM_ID_VERSION),
  action: z.enum(['add', 'edit']),
  targetId: snowflakeSchema,
});

export type NoteModalCustomId = z.infer<typeof NoteModalCustomIdSchema>;

/**
 * Encode a note modal custom_id
 */
export function encodeNoteModalCustomId(action: 'add' | 'edit', targetId: string): string {
  return `modnote:${CUSTOM_ID_VERSION}:${action}:${targetId}`;
}

/**
 * Decode and validate a note modal custom_id
 */
export function decodeNoteModalCustomId(customId: string): NoteModalCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, action, targetId] = parts;

  const result = NoteModalCustomIdSchema.safeParse({
    prefix,
    version,
    action,
    targetId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

// ==================== Timeout/Tempban Modal Custom ID ====================

/**
 * Schema for duration modal custom_id
 * Format: moddur:v1:{action}:{targetId}
 */
export const DurationModalCustomIdSchema = z.object({
  prefix: z.literal('moddur'),
  version: z.literal(CUSTOM_ID_VERSION),
  action: z.enum(['timeout', 'tempban']),
  targetId: snowflakeSchema,
});

export type DurationModalCustomId = z.infer<typeof DurationModalCustomIdSchema>;

/**
 * Encode a duration modal custom_id
 */
export function encodeDurationModalCustomId(
  action: 'timeout' | 'tempban',
  targetId: string
): string {
  return `moddur:${CUSTOM_ID_VERSION}:${action}:${targetId}`;
}

/**
 * Decode and validate a duration modal custom_id
 */
export function decodeDurationModalCustomId(customId: string): DurationModalCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, action, targetId] = parts;

  const result = DurationModalCustomIdSchema.safeParse({
    prefix,
    version,
    action,
    targetId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

// ==================== Reason Modal Custom ID ====================

/**
 * Schema for reason modal custom_id
 * Format: modreason:v1:{action}:{targetId}
 */
export const ReasonModalCustomIdSchema = z.object({
  prefix: z.literal('modreason'),
  version: z.literal(CUSTOM_ID_VERSION),
  action: z.enum(['warn', 'kick', 'ban', 'softban']),
  targetId: snowflakeSchema,
});

export type ReasonModalCustomId = z.infer<typeof ReasonModalCustomIdSchema>;

/**
 * Encode a reason modal custom_id
 */
export function encodeReasonModalCustomId(
  action: 'warn' | 'kick' | 'ban' | 'softban',
  targetId: string
): string {
  return `modreason:${CUSTOM_ID_VERSION}:${action}:${targetId}`;
}

/**
 * Decode and validate a reason modal custom_id
 */
export function decodeReasonModalCustomId(customId: string): ReasonModalCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, action, targetId] = parts;

  const result = ReasonModalCustomIdSchema.safeParse({
    prefix,
    version,
    action,
    targetId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

// ==================== Mute Modal Custom ID ====================

/**
 * Schema for mute modal custom_id
 * Format: modmute:v1:{action}:{targetId}
 */
export const MuteModalCustomIdSchema = z.object({
  prefix: z.literal('modmute'),
  version: z.literal(CUSTOM_ID_VERSION),
  action: z.enum(['text', 'voice', 'both']),
  targetId: snowflakeSchema,
});

export type MuteModalCustomId = z.infer<typeof MuteModalCustomIdSchema>;

/**
 * Encode a mute modal custom_id
 */
export function encodeMuteModalCustomId(
  action: 'text' | 'voice' | 'both',
  targetId: string
): string {
  return `modmute:${CUSTOM_ID_VERSION}:${action}:${targetId}`;
}

/**
 * Decode and validate a mute modal custom_id
 */
export function decodeMuteModalCustomId(customId: string): MuteModalCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, action, targetId] = parts;

  const result = MuteModalCustomIdSchema.safeParse({
    prefix,
    version,
    action,
    targetId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

// ==================== History Pagination Custom ID ====================

const HISTORY_PREFIX = 'modhistory';

/**
 * Get the base custom ID for history pagination
 * Format: modhistory:v1:{targetId}:{page}
 * paginationRow will append :prev, :next, etc.
 */
export function getHistoryPaginationBase(targetId: string, page: number = 1): string {
  return `${HISTORY_PREFIX}:${CUSTOM_ID_VERSION}:${targetId}:${page}`;
}

/**
 * Decode a history pagination custom_id
 * Format: modhistory:v1:{targetId}:{page}:{action}
 * where action is 'prev', 'next', 'first', 'last', or 'info'
 */
export function decodeHistoryPaginationCustomId(
  customId: string
): { targetId: string; page: number; action: string } | null {
  const parts = customId.split(':');

  if (parts.length !== 5 || parts[0] !== HISTORY_PREFIX || parts[1] !== CUSTOM_ID_VERSION) {
    return null;
  }

  const targetId = parts[2];
  const pageStr = parts[3];
  const action = parts[4];

  if (!targetId || !pageStr || !action) {
    return null;
  }

  const page = parseInt(pageStr, 10);

  if (isNaN(page)) {
    return null;
  }

  return { targetId, page, action };
}

/**
 * Check if a custom_id is a history pagination interaction
 */
export function isHistoryPaginationCustomId(customId: string): boolean {
  return customId.startsWith(`${HISTORY_PREFIX}:${CUSTOM_ID_VERSION}:`);
}

// ==================== Evidence Capture Modal Custom ID ====================

/**
 * Schema for evidence capture modal custom_id
 * Format: evidence_capture:v1:{messageId}:{channelId}
 */
export const EvidenceCaptureModalCustomIdSchema = z.object({
  prefix: z.literal('evidence_capture'),
  version: z.literal(CUSTOM_ID_VERSION),
  messageId: snowflakeSchema,
  channelId: snowflakeSchema,
});

export type EvidenceCaptureModalCustomId = z.infer<typeof EvidenceCaptureModalCustomIdSchema>;

/**
 * Encode an evidence capture modal custom_id
 */
export function encodeEvidenceCaptureModalCustomId(messageId: string, channelId: string): string {
  return `evidence_capture:${CUSTOM_ID_VERSION}:${messageId}:${channelId}`;
}

/**
 * Decode and validate an evidence capture modal custom_id
 */
export function decodeEvidenceCaptureModalCustomId(
  customId: string
): EvidenceCaptureModalCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, messageId, channelId] = parts;

  const result = EvidenceCaptureModalCustomIdSchema.safeParse({
    prefix,
    version,
    messageId,
    channelId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

// ==================== Evidence Pending Action Select Menu Custom ID ====================

/**
 * Schema for evidence pending action select menu custom_id
 * Used when evidence is captured without a case — case will be created with mod action.
 * Format: evidence_pending:v1:{targetId}:{snapshotId}
 */
export const EvidencePendingActionCustomIdSchema = z.object({
  prefix: z.literal('evidence_pending'),
  version: z.literal(CUSTOM_ID_VERSION),
  targetId: snowflakeSchema,
  snapshotId: z.string().min(1),
});

export type EvidencePendingActionCustomId = z.infer<typeof EvidencePendingActionCustomIdSchema>;

/**
 * Encode an evidence pending action select menu custom_id
 */
export function encodeEvidencePendingActionCustomId(targetId: string, snapshotId: string): string {
  return `evidence_pending:${CUSTOM_ID_VERSION}:${targetId}:${snapshotId}`;
}

/**
 * Decode and validate an evidence pending action select menu custom_id
 */
export function decodeEvidencePendingActionCustomId(
  customId: string
): EvidencePendingActionCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, targetId, snapshotId] = parts;

  const result = EvidencePendingActionCustomIdSchema.safeParse({
    prefix,
    version,
    targetId,
    snapshotId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

/**
 * Schema for evidence pending mod action modal custom_id
 * Used when a moderator picks a follow-up action after evidence capture without a case.
 * Creates a new case and links the snapshot as evidence.
 * Format: evidence_pending_mod:v1:{action}:{targetId}:{snapshotId}
 */
export const EvidencePendingModActionCustomIdSchema = z.object({
  prefix: z.literal('evidence_pending_mod'),
  version: z.literal(CUSTOM_ID_VERSION),
  action: z.enum(['warn', 'kick', 'ban', 'softban', 'timeout', 'tempban']),
  targetId: snowflakeSchema,
  snapshotId: z.string().min(1),
});

export type EvidencePendingModActionCustomId = z.infer<
  typeof EvidencePendingModActionCustomIdSchema
>;

/**
 * Encode an evidence pending mod action modal custom_id
 */
export function encodeEvidencePendingModActionCustomId(
  action: 'warn' | 'kick' | 'ban' | 'softban' | 'timeout' | 'tempban',
  targetId: string,
  snapshotId: string
): string {
  return `evidence_pending_mod:${CUSTOM_ID_VERSION}:${action}:${targetId}:${snapshotId}`;
}

/**
 * Decode and validate an evidence pending mod action modal custom_id
 */
export function decodeEvidencePendingModActionCustomId(
  customId: string
): EvidencePendingModActionCustomId | null {
  const parts = customId.split(':');

  if (parts.length !== 5) {
    return null;
  }

  const [prefix, version, action, targetId, snapshotId] = parts;

  const result = EvidencePendingModActionCustomIdSchema.safeParse({
    prefix,
    version,
    action,
    targetId,
    snapshotId,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
}

// ==================== Helper to check all mod interaction types ====================

/**
 * Check if a custom_id belongs to any mod interaction type
 */
export function isModInteractionCustomId(customId: string): boolean {
  return (
    customId.startsWith('modpanel:') ||
    customId.startsWith('modnote:') ||
    customId.startsWith('moddur:') ||
    customId.startsWith('modreason:') ||
    customId.startsWith('modmute:') ||
    customId.startsWith(`${HISTORY_PREFIX}:`) ||
    customId.startsWith('evidence_capture:') ||
    customId.startsWith('evidence_pending:') ||
    customId.startsWith('evidence_pending_mod:')
  );
}
