/**
 * Moderation Discord UI Module
 *
 * Re-exports all moderation-specific Discord UI components.
 */

// Modlog builders
export { buildModLogEntry, getModLogMessageOptions, type ModLogEntry } from './modlog.js';

// Panel builders
export {
  type ModPanelContext,
  buildModPanel,
  buildContextBundle,
  buildNotesList,
  buildModActionSuccess,
  buildModActionError,
} from './panelBuilder.js';

// Custom IDs
export {
  ModPanelAction,
  encodeModPanelCustomId,
  decodeModPanelCustomId,
  isModPanelCustomId,
} from './customId.js';

// Embed presets
export {
  formatDuration,
  createModEmbed,
  createUserNotificationEmbed,
  notifyUser,
  createCaseEmbed,
  createHistoryEmbed,
  logModAction,
  logToModChannel,
} from './embeds/presets.js';

// Modals
export {
  reasonModal,
  durationModal,
  noteModal,
  banModal,
  tempbanModal,
  timeoutModal,
  warnModal,
  kickModal,
} from './modals.js';

// Note: For shared Discord utilities (COLORS, EMOJI, formatters, reply helpers, message builders),
// import directly from '#lib/discord/index.js'
