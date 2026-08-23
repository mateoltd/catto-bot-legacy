/**
 * Discord Permission Utilities
 *
 * Utilities for checking Discord permissions.
 * Includes voice moderation checks and basic permission checks.
 *
 * Note: For command authorization and hierarchy validation, use the Gate system
 * (see lib/validation/Gate.ts and lib/validation/gateContext.ts).
 */

import type { GuildMember, PermissionResolvable } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

// Basic Permission Checks

/**
 * Check if a member has a specific Discord permission.
 */
export function hasPermission(
  member: GuildMember | null | undefined,
  permission: PermissionResolvable
): boolean {
  return member?.permissions.has(permission) ?? false;
}

/**
 * Check if a member has Administrator permission.
 */
export function isAdmin(member: GuildMember | null | undefined): boolean {
  return hasPermission(member, PermissionFlagsBits.Administrator);
}

// Voice Moderation Permissions

/**
 * Voice-specific moderation permissions.
 * These are the permissions needed to fully moderate voice channels.
 * Used for mod shield indicators and voice mod detection.
 */
const VOICE_MOD_PERMISSIONS: PermissionResolvable[] = [
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.KickMembers,
];

/**
 * Check if a member has voice moderation permissions.
 * Requires ALL of: MuteMembers, DeafenMembers, MoveMembers, KickMembers.
 */
export function hasVoiceModPermissions(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  return VOICE_MOD_PERMISSIONS.every((perm) => member.permissions.has(perm));
}

/**
 * Check if a member has any voice moderation permission.
 * Having ANY of MuteMembers, DeafenMembers, MoveMembers, or KickMembers qualifies.
 */
export function hasAnyVoiceModPermission(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  return VOICE_MOD_PERMISSIONS.some((perm) => member.permissions.has(perm));
}
