/** Canonical prefix namespace for moderation actions. */
export const MODERATION_NAMESPACE = 'mod';

/**
 * Unambiguous moderation actions that may also be invoked as top-level commands.
 * The values are their canonical permission resource keys.
 */
export const MODERATION_DIRECT_SHORTCUTS = {
  ban: 'mod.ban',
  kick: 'mod.kick',
  timeout: 'mod.timeout',
  warn: 'mod.warn',
  unban: 'mod.unban',
  case: 'mod.case',
  void: 'mod.void',
  history: 'mod.history',
  softban: 'mod.softban',
  tempban: 'mod.tempban',
  panel: 'mod.panel',
  mutes: 'mod.mutes',
} as const;

/** Group shortcuts use distinct names when the natural root would collide. */
export const MODERATION_GROUP_SHORTCUTS: Readonly<Record<string, string>> = {
  voice: 'mvc',
  note: 'note',
  evidence: 'evidence',
  mute: 'mute',
  unmute: 'unmute',
};
