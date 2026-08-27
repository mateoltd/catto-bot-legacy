/**
 * DCB - Discord Component Builder
 *
 * A comprehensive library for building Discord UI components.
 *
 * @example
 * ```ts
 * import { container, successMessage, defer, reply, editReply, COLORS } from '#lib/discord/index.js';
 *
 * // Build a container message
 * const msg = successMessage('Done!', 'Operation completed.');
 *
 * // Reply to an interaction
 * await reply(interaction, msg);
 *
 * // Deferred workflow
 * await defer(interaction);
 * await editReply(interaction, container().h1('Complete!').text('All done.'));
 * ```
 */

// Design Tokens

export { COLORS, EMOJI, SPACING, ERROR_ICONS } from './design/index.js';

// Core Utilities

export {
  // Custom IDs
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
  // Formatting
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
  // User display
  type UserDisplayOptions,
  type UserDisplayResult,
  getUserDisplayLabel,
  getUserDisplayLabelSync,
  getSafeUserTag,
  isPlaceholderTag,
  formatUserForLog,
  // Reply helpers
  type RepliableInteraction,
  type MessageContainer,
  defer,
  reply,
  editReply,
  // CommandResponder
  type CommandResponder,
  type CommandResponse,
  InteractionResponder,
  MessageResponder,
  // Types
  type UIResponse,
  type PaginationState,
  type SortOptions,
  type UserDisplayData,
  type TimestampFormat,
  type InteractionResult,
  type DeferredReplyState,
  getUserDisplayData,
  createTimestamp,
} from './core/index.js';

// Containers (Components V2)

export {
  FluentContainer,
  container,
  successContainer,
  errorContainer,
  warningContainer,
  infoContainer,
  primaryContainer,
  neutralContainer,
  simpleMessage,
  successMessage,
  errorMessage,
  warningMessage,
  infoMessage,
  loadingMessage,
  type AccentColor,
  type ContainerComponent,
  type ContainerOptions,
  type FluentButtonConfig,
  type FluentLinkButtonConfig,
} from './containers/index.js';

// Embeds (Traditional)

export {
  FluentEmbed,
  fluentEmbed,
  fluentSuccess,
  fluentError,
  fluentWarning,
  fluentInfo,
  fluentNeutral,
  pipeEmbed,
  composeEmbed,
  whenEmbed,
  withUser,
  withTimestampFooter,
  type EmbedTransform,
  embed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  neutralEmbed,
  buildSuccessEmbed,
  buildErrorEmbed,
  buildWarningEmbed,
  buildInfoEmbed,
  buildStatsEmbed,
  buildListEmbed,
  buildUserEmbed,
} from './embeds/index.js';

// Components (Buttons, Selects, Modals)

export {
  // Button types
  type ButtonConfig,
  type SimpleButtonConfig,
  type LinkButtonConfig,
  // Button factories
  button,
  primaryButton,
  secondaryButton,
  successButton,
  dangerButton,
  linkButton,
  // Row builders
  buttonRow,
  row,
  // Button presets
  confirmButton,
  cancelButton,
  deleteButton,
  refreshButton,
  backButton,
  nextButton,
  doneButton,
  editButton,
  viewButton,
  // Preset rows
  confirmationRow,
  paginationRow,
  navigationRow,
  // Select types
  type SelectOption,
  type SelectMenuConfig,
  type StringSelectConfig,
  type ChannelSelectConfig,
  type RoleSelectConfig,
  type UserSelectConfig,
  type MentionableSelectConfig,
  // String select
  stringSelect,
  stringSelectRow,
  yesNoSelect,
  pageSelect,
  // Channel select
  channelSelect,
  channelSelectRow,
  textChannelSelect,
  voiceChannelSelect,
  categorySelect,
  // Role select
  roleSelect,
  roleSelectRow,
  singleRoleSelect,
  multiRoleSelect,
  // User select
  userSelect,
  userSelectRow,
  singleUserSelect,
  multiUserSelect,
  // Mentionable select
  mentionableSelect,
  mentionableSelectRow,
  singleMentionableSelect,
  // Modal types
  type TextInputConfig,
  type ModalConfig,
  // Text input builders
  textInput,
  shortInput,
  paragraphInput,
  inputRow,
  // Modal builders
  modal,
  singleInputModal,
  paragraphModal,
  formModal,
} from './components/index.js';

// Plain Text Responses

export {
  type ErrorData,
  type SuccessData,
  buildSuccessText,
  buildErrorText,
  buildWarningText,
  buildInfoText,
  ephemeralError,
  ephemeralSuccess,
  editError,
  editSuccess,
} from './responses.js';

// ============================================================================
// Command Handlers
// ============================================================================

export {
  type HandlerResult,
  type ModerationContext,
  type TargetContext,
  type ErrorHandlerOptions,
  parseWithValidation,
  fetchMemberSafe,
  requireMember,
  checkBotPermission,
  withDeferredHandler,
} from './handlers.js';
