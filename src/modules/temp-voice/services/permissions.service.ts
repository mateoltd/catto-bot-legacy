/**
 * Service for building Discord permission overwrites for temp voice channels
 */

import { PermissionFlagsBits, OverwriteResolvable, OverwriteType } from 'discord.js';

/**
 * Options for building permission overwrites
 */
export interface PermissionOverwriteBuilderOptions {
  /** The owner user ID who gets full access */
  ownerId: string;
  /** The guild ID (used for @everyone role) */
  guildId: string;
  /** Whether the channel is locked (deny CONNECT for @everyone) */
  isLocked: boolean;
  /** Whether the channel is hidden (deny VIEW_CHANNEL for @everyone) */
  isHidden: boolean;
  /** Array of user IDs who are explicitly allowed */
  allowedUserIds: string[];
  /** Array of user IDs who are explicitly denied */
  deniedUserIds: string[];
  /** Array of user IDs who are trusted (can manage channel like owner, except claim) */
  trustedUserIds: string[];
}

/**
 * Service for managing permissions for temp voice channels
 */
export class PermissionsService {
  /**
   * Build permission overwrites for a temp voice channel
   */
  public buildOverwrites(options: PermissionOverwriteBuilderOptions): OverwriteResolvable[] {
    const overwrites: OverwriteResolvable[] = [];

    // Owner always has full access
    overwrites.push({
      id: options.ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
      ],
      type: OverwriteType.Member,
    });

    // Trusted users get the same permissions as owner
    for (const userId of options.trustedUserIds) {
      // Skip if it's the owner (already has access)
      if (userId === options.ownerId) continue;

      overwrites.push({
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.Stream,
          PermissionFlagsBits.UseVAD,
        ],
        type: OverwriteType.Member,
      });
    }

    // @everyone base permissions
    const everyoneAllow: bigint[] = [
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.UseVAD,
    ];
    const everyoneDeny: bigint[] = [];

    // Handle visibility
    if (options.isHidden) {
      everyoneDeny.push(PermissionFlagsBits.ViewChannel);
    } else {
      everyoneAllow.push(PermissionFlagsBits.ViewChannel);
    }

    // Handle lock state
    if (options.isLocked) {
      everyoneDeny.push(PermissionFlagsBits.Connect);
    } else {
      everyoneAllow.push(PermissionFlagsBits.Connect);
    }

    overwrites.push({
      id: options.guildId, // @everyone role ID = guild ID
      allow: everyoneAllow,
      deny: everyoneDeny,
      type: OverwriteType.Role,
    });

    // Explicitly allowed users (can bypass locks/hides)
    for (const userId of options.allowedUserIds) {
      // Skip if it's the owner (already has access)
      if (userId === options.ownerId) continue;

      overwrites.push({
        id: userId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        type: OverwriteType.Member,
      });
    }

    // Explicitly denied users (cannot access even if unlocked)
    for (const userId of options.deniedUserIds) {
      // Owner cannot be denied
      if (userId === options.ownerId) continue;

      overwrites.push({
        id: userId,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        type: OverwriteType.Member,
      });
    }

    return overwrites;
  }

  /**
   * Check if a user can manage a temp voice channel
   */
  public canManageChannel(
    userId: string,
    ownerId: string,
    adminRoleIds: string[],
    memberRoleIds: string[],
    isAdministrator: boolean,
    trustedUserIds: string[] = []
  ): boolean {
    // Owner can always manage
    if (userId === ownerId) return true;

    // Trusted users can manage
    if (trustedUserIds.includes(userId)) return true;

    // Server administrators can manage
    if (isAdministrator) return true;

    // Check if user has any admin role
    return adminRoleIds.some((roleId) => memberRoleIds.includes(roleId));
  }

  /**
   * Check if a user can transfer ownership (claim command)
   * Only owner and admins can transfer, trusted users cannot
   */
  public canTransferOwnership(
    userId: string,
    ownerId: string,
    adminRoleIds: string[],
    memberRoleIds: string[],
    isAdministrator: boolean
  ): boolean {
    // Owner can transfer
    if (userId === ownerId) return true;

    // Server administrators can transfer
    if (isAdministrator) return true;

    // Check if user has any admin role
    return adminRoleIds.some((roleId) => memberRoleIds.includes(roleId));
  }

  /**
   * Get required permissions for the bot to manage temp channels
   */
  public getRequiredBotPermissions(): bigint[] {
    return [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles, // For permission overwrites
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.Connect,
    ];
  }

  /**
   * Check if bot has required permissions in a category
   */
  public hasRequiredPermissions(botPermissions: bigint): boolean {
    const required = this.getRequiredBotPermissions();
    return required.every((perm) => (botPermissions & perm) === perm);
  }

  /**
   * Get maximum bitrate based on guild boost level
   */
  public getMaxBitrate(premiumTier: number): number {
    switch (premiumTier) {
      case 3:
        return 384000; // 384 kbps
      case 2:
        return 256000; // 256 kbps
      case 1:
        return 128000; // 128 kbps
      default:
        return 96000; // 96 kbps
    }
  }

  /**
   * Validate bitrate for guild boost level
   */
  public validateBitrate(
    bitrate: number,
    premiumTier: number
  ): {
    valid: boolean;
    maxAllowed: number;
  } {
    const maxAllowed = this.getMaxBitrate(premiumTier);
    return {
      valid: bitrate <= maxAllowed,
      maxAllowed,
    };
  }
}
