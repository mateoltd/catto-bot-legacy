/**
 * DCB Core - Utilities and helpers
 */

export {
  type ParsedCustomId,
  encodeCustomId,
  decodeCustomId,
  matchesCustomId,
  extractFirstParam,
  extractParams,
  encodeWithNonce,
  stripNonce,
  isValidCustomId,
  sanitizeForCustomId,
} from './customId.js';

export {
  formatStatsLine,
  formatUserMention,
  formatRelativeTimestamp,
  formatAbsoluteTimestamp,
  truncateText,
  formatPaginationInfo,
  formatDuration,
  formatDurationShort,
  timestamp,
  userMention,
  channelMention,
  roleMention,
  safeTag,
} from './format.js';

export {
  type UserDisplayOptions,
  type UserDisplayResult,
  getUserDisplayLabel,
  getUserDisplayLabelSync,
  getSafeUserTag,
  isPlaceholderTag,
  formatUserForLog,
} from './userDisplay.js';

export {
  type RepliableInteraction,
  type MessageContainer,
  defer,
  reply,
  editReply,
} from './reply.js';

export {
  type CommandResponder,
  type CommandResponse,
  InteractionResponder,
  MessageResponder,
} from './responder.js';

export {
  type UIResponse,
  type PaginationState,
  type SortOptions,
  type UserDisplayData,
  type TimestampFormat,
  type InteractionResult,
  type DeferredReplyState,
  getUserDisplayData,
  createTimestamp,
} from './types.js';
