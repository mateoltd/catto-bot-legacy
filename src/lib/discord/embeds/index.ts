/**
 * DCB Embeds - Traditional embed builders
 */

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
} from './fluent.js';

export {
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
} from './presets.js';
