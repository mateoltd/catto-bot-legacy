/**
 * Feature Flag System
 *
 * Simple guild-level feature flags for gating experimental or server-specific features.
 * Flags are hardcoded constants mapping flag names to allowed guild IDs.
 *
 * @example
 * ```ts
 * import { isFeatureEnabled } from '#lib/features/featureFlags.js';
 *
 * if (!isFeatureEnabled('creative-bans', guildId)) return;
 * ```
 */

const FEATURE_FLAGS: Record<string, Set<string>> = {
  'creative-bans': new Set(['790289803219566633']),
};

/**
 * Check if a feature flag is enabled for a given guild.
 *
 * @param flag - The feature flag name
 * @param guildId - The guild ID to check
 * @returns true if the feature is enabled for this guild
 */
export function isFeatureEnabled(flag: string, guildId: string): boolean {
  const allowedGuilds = FEATURE_FLAGS[flag];
  if (!allowedGuilds) return false;
  return allowedGuilds.has(guildId);
}
