/**
 * TypeScript interfaces for Temp Voice channels
 */

import { TempVoiceChannel } from '@prisma/client';

/**
 * Metadata stored for temp voice channels
 */
export interface TempVoiceChannelMetadata {
  /** Number of times ownership has been transferred */
  ownershipTransfers?: number;
  /** Array of previous owner user IDs */
  previousOwners?: string[];
  /** Total number of joins to this channel */
  totalJoins?: number;
  /** Number of times channel creation was attempted */
  creationAttempts?: number;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Active temporary voice channel record
 */
// export interface TempVoiceChannel {
// 	id: string;
// 	guildId: string;
// 	channelId: string;
// 	ownerId: string;

// 	// Creation context
// 	createdByJoinChannelId: string;
// 	createdAt: Date;
// 	lastActiveAt: Date;

// 	// Custom settings (null = using defaults)
// 	customName: string | null;
// 	customUserLimit: number | null;
// 	customBitrate: number | null;
// 	customRegion: string | null;

// 	// State flags
// 	isLocked: boolean;
// 	isHidden: boolean;

// 	// Permission overrides
// 	allowedUserIds: string[];
// 	deniedUserIds: string[];

// 	// Deletion management
// 	deletionScheduledAt: Date | null;

// 	// Control panel
// 	controlPanelMessageId: string | null;
// 	controlPanelChannelId: string | null;

// 	// Metadata
// 	metadata: TempVoiceChannelMetadata;

// 	updatedAt: Date;
// }

/**
 * Data for creating a new temp voice channel
 */
export interface CreateTempChannelData {
  guildId: string;
  ownerId: string;
  createdByJoinChannelId: string;
  customName?: string;
  isLocked?: boolean;
  isHidden?: boolean;
}

/**
 * Data for updating a temp voice channel
 */
export interface UpdateTempChannelData {
  customName?: string | null;
  customUserLimit?: number;
  customBitrate?: number;
  customRegion?: string;
  isLocked?: boolean;
  isHidden?: boolean;
  allowedUserIds?: string[];
  deniedUserIds?: string[];
  trustedUserIds?: string[];
  ownerId?: string;
  deletionScheduledAt?: Date | null;
  controlPanelMessageId?: string | null;
  controlPanelChannelId?: string | null;
  lastActiveAt?: Date;
}

/**
 * Member information for API responses
 */
export interface TempVoiceChannelMember {
  id: string;
  username: string;
  discriminator: string;
  displayName: string;
}

/**
 * Extended channel info with current Discord state
 */
export interface TempVoiceChannelWithMembers extends TempVoiceChannel {
  currentMembers: TempVoiceChannelMember[];
}
