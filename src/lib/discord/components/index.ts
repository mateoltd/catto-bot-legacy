/**
 * Discord Components
 *
 * Re-exports all component builders for easy importing.
 */

// Select menu builders
export {
  // Types
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
} from './selects.js';

// Button builders
export {
  // Types
  type ButtonConfig,
  type SimpleButtonConfig,
  type LinkButtonConfig,
  // Factories
  button,
  primaryButton,
  secondaryButton,
  successButton,
  dangerButton,
  linkButton,
  // Row builders
  buttonRow,
  row,
  // Presets
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
} from './buttons.js';

// Modal builders
export {
  // Types
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
} from './modals.js';
