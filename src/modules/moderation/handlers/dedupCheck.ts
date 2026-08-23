/**
 * Dedup Check Helper for Command Handlers
 *
 * Provides a standalone function that slash command handlers can call
 * before executing a mod action. Returns the dedup warning container
 * if a duplicate is detected, or null to proceed.
 */

import type { Guild, User } from 'discord.js';
import { ModAction } from '@prisma/client';
import { checkAndSetDedup, storePendingOverride } from '../services/DedupService.js';
import { buildDedupWarning } from '../discord/panelBuilder.js';
import type { FluentContainer } from '#lib/discord/index.js';
import type { DurationSeconds } from '../domain/types.js';
import { safeTag } from '#lib/discord/index.js';

export interface DedupCheckInput {
  guild: Guild;
  target: User | { id: string; tag: string };
  moderator: User;
  action: ModAction;
  reason: string;
  duration?: DurationSeconds | number;
  /** Extra context to preserve for the override (e.g. deleteMessages) */
  extra?: Record<string, unknown>;
}

/**
 * Check for duplicate mod action. Returns a warning FluentContainer if
 * duplicate detected, or null if clear to proceed.
 */
export async function commandDedupCheck(input: DedupCheckInput): Promise<FluentContainer | null> {
  const result = await checkAndSetDedup(
    input.guild.id,
    input.target.id,
    input.action,
    input.moderator.id,
    input.moderator.tag,
    input.reason
  );

  if (!result.isDuplicate || !result.existing) return null;

  // Store pending override
  const pendingId = await storePendingOverride({
    guildId: input.guild.id,
    targetId: input.target.id,
    action: input.action,
    reason: input.reason,
    duration: input.duration as number | undefined,
    moderatorId: input.moderator.id,
    extra: input.extra,
  });

  return buildDedupWarning(
    input.action,
    safeTag(input.target.tag),
    safeTag(result.existing.moderatorTag),
    result.existing.timestamp,
    pendingId
  );
}
