/**
 * Reward System Type Definitions
 * Comprehensive types for the per-guild customizable XP reward system
 */

// ============================================
// Reward Types
// ============================================

export enum RewardType {
  // Role-based rewards
  ROLE_ADD = 'ROLE_ADD', // Add a role
  ROLE_REMOVE = 'ROLE_REMOVE', // Remove a role
  ROLE_STACK = 'ROLE_STACK', // Add role, keep previous
  ROLE_REPLACE = 'ROLE_REPLACE', // Replace with new role

  // Permission rewards
  PERMISSION_GRANT = 'PERMISSION_GRANT', // Grant specific permissions
  PERMISSION_REVOKE = 'PERMISSION_REVOKE', // Revoke permissions

  // Channel access
  CHANNEL_ACCESS = 'CHANNEL_ACCESS', // Grant channel access
  CHANNEL_REVOKE = 'CHANNEL_REVOKE', // Revoke channel access
  CATEGORY_ACCESS = 'CATEGORY_ACCESS', // Grant category access

  // Economy rewards
  CURRENCY_GRANT = 'CURRENCY_GRANT', // Award virtual currency
  CURRENCY_MULTIPLIER = 'CURRENCY_MULTIPLIER', // Permanent currency boost

  // XP rewards
  XP_MULTIPLIER = 'XP_MULTIPLIER', // XP boost (temporary or permanent)
  XP_BONUS = 'XP_BONUS', // One-time XP bonus
  DOUBLE_XP_TOKEN = 'DOUBLE_XP_TOKEN', // Activatable XP boost

  // Social rewards
  NICKNAME_UNLOCK = 'NICKNAME_UNLOCK', // Can change nickname freely
  COLOR_UNLOCK = 'COLOR_UNLOCK', // Choose role color
  CUSTOM_STATUS = 'CUSTOM_STATUS', // Custom status/title
  PROFILE_BADGE = 'PROFILE_BADGE', // Visual badge

  // Feature unlocks
  COMMAND_UNLOCK = 'COMMAND_UNLOCK', // Unlock bot commands
  FEATURE_UNLOCK = 'FEATURE_UNLOCK', // Unlock bot features
  EMBED_UNLOCK = 'EMBED_UNLOCK', // Can post embeds/links

  // Voice-specific
  VOICE_PRIORITY = 'VOICE_PRIORITY', // Priority speaker
  VOICE_SOUNDBOARD = 'VOICE_SOUNDBOARD', // Soundboard access
  VOICE_ACTIVITY = 'VOICE_ACTIVITY', // Activity detection priority

  // Special rewards
  CUSTOM_REWARD = 'CUSTOM_REWARD', // Custom logic reward
  WEBHOOK_TRIGGER = 'WEBHOOK_TRIGGER', // Trigger external webhook
  ANNOUNCEMENT = 'ANNOUNCEMENT', // Server announcement
}

export enum XPType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  BOTH = 'BOTH',
}

export enum RewardStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

// ============================================
// Reward Data Interfaces
// ============================================

export interface RoleRewardData {
  roleId: string;
  action: 'ADD' | 'REMOVE' | 'STACK' | 'REPLACE';
  removeRoles?: string[]; // Roles to remove when adding (for REPLACE)
}

export interface PermissionRewardData {
  permissions: string[]; // Discord permission flags
  channelIds?: string[]; // Specific channels (optional)
}

export interface ChannelAccessRewardData {
  channelIds: string[];
  categoryIds?: string[];
  action: 'ADD' | 'REMOVE';
  overwriteType?: 'ALLOW' | 'DENY';
}

export interface CurrencyRewardData {
  amount: number;
  currencyType?: string; // e.g., 'coins', 'tokens', 'points'
  reason?: string;
}

export interface MultiplierRewardData {
  multiplier: number; // e.g., 1.5 for 50% bonus
  durationMinutes?: number; // null = permanent
  stackable?: boolean;
  xpType?: 'TEXT' | 'VOICE' | 'BOTH';
}

export interface BadgeRewardData {
  badgeId: string;
  emoji?: string;
  displayName: string;
  description?: string;
  rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

export interface CommandUnlockData {
  commandNames: string[];
  categoryNames?: string[];
}

export interface AnnouncementRewardData {
  channelId?: string; // null = level-up announcement channel
  message: string;
  embedConfig?: {
    title?: string;
    description?: string;
    color?: number;
    thumbnail?: string;
    footer?: string;
  };
  mentionUser?: boolean;
}

export interface WebhookRewardData {
  webhookUrl: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface CustomRewardData {
  customType: string;
  data: Record<string, unknown>;
}

export type RewardData =
  | RoleRewardData
  | PermissionRewardData
  | ChannelAccessRewardData
  | CurrencyRewardData
  | MultiplierRewardData
  | BadgeRewardData
  | CommandUnlockData
  | AnnouncementRewardData
  | WebhookRewardData
  | CustomRewardData;

// ============================================
// Configuration Interfaces
// ============================================

export interface LevelRewardConfig {
  id?: string;
  guildId: string;
  level: number;
  xpType: XPType;
  rewardType: RewardType;
  rewardData: RewardData;
  name: string;
  description?: string;
  icon?: string;
  oneTime?: boolean;
  stackable?: boolean;
  requiresPrevious?: boolean;
  priority?: number;
  enabled?: boolean;
}

export interface RewardClaimResult {
  success: boolean;
  reward: LevelRewardConfig;
  error?: string;
  details?: {
    rolesAdded?: string[];
    rolesRemoved?: string[];
    permissionsGranted?: string[];
    channelsUnlocked?: string[];
    currencyAwarded?: number;
    multiplierApplied?: number;
  };
}

export interface RewardCheckResult {
  eligible: boolean;
  rewards: LevelRewardConfig[];
  alreadyClaimed: string[];
  missingRequirements?: string[];
}

// ============================================
// Template System
// ============================================

export interface RewardTemplateConfig {
  name: string;
  description?: string;
  category: 'ROLES' | 'ECONOMY' | 'ACCESS' | 'MIXED';
  rewards: Omit<LevelRewardConfig, 'id' | 'guildId'>[];
}

export const PRESET_TEMPLATES: Record<string, RewardTemplateConfig> = {
  BASIC_ROLES: {
    name: 'Basic Role Progression',
    description: 'Simple role rewards every 10 levels',
    category: 'ROLES',
    rewards: [
      {
        level: 10,
        xpType: XPType.BOTH,
        rewardType: RewardType.ROLE_ADD,
        rewardData: { roleId: 'PLACEHOLDER', action: 'ADD' } as RoleRewardData,
        name: 'Bronze Member',
        icon: '🥉',
        oneTime: true,
        stackable: true,
      },
      {
        level: 25,
        xpType: XPType.BOTH,
        rewardType: RewardType.ROLE_ADD,
        rewardData: { roleId: 'PLACEHOLDER', action: 'ADD' } as RoleRewardData,
        name: 'Silver Member',
        icon: '🥈',
        oneTime: true,
        stackable: true,
      },
      {
        level: 50,
        xpType: XPType.BOTH,
        rewardType: RewardType.ROLE_ADD,
        rewardData: { roleId: 'PLACEHOLDER', action: 'ADD' } as RoleRewardData,
        name: 'Gold Member',
        icon: '🥇',
        oneTime: true,
        stackable: true,
      },
    ],
  },

  ECONOMY_FOCUS: {
    name: 'Economy Rewards',
    description: 'Currency and multiplier rewards',
    category: 'ECONOMY',
    rewards: [
      {
        level: 5,
        xpType: XPType.BOTH,
        rewardType: RewardType.CURRENCY_GRANT,
        rewardData: { amount: 500, currencyType: 'coins' } as CurrencyRewardData,
        name: 'Starter Bonus',
        icon: '💰',
        oneTime: true,
      },
      {
        level: 20,
        xpType: XPType.BOTH,
        rewardType: RewardType.XP_MULTIPLIER,
        rewardData: { multiplier: 1.1, xpType: 'BOTH' } as MultiplierRewardData,
        name: '10% XP Boost',
        icon: '⚡',
        oneTime: true,
        stackable: true,
      },
    ],
  },

  CHANNEL_ACCESS: {
    name: 'Progressive Channel Access',
    description: 'Unlock channels as you level up',
    category: 'ACCESS',
    rewards: [
      {
        level: 15,
        xpType: XPType.BOTH,
        rewardType: RewardType.CHANNEL_ACCESS,
        rewardData: { channelIds: ['PLACEHOLDER'], action: 'ADD' } as ChannelAccessRewardData,
        name: 'VIP Lounge Access',
        icon: '🚪',
        oneTime: true,
      },
    ],
  },

  VOICE_SPECIALIST: {
    name: 'Voice Activity Rewards',
    description: 'Rewards specifically for voice activity',
    category: 'MIXED',
    rewards: [
      {
        level: 10,
        xpType: XPType.VOICE,
        rewardType: RewardType.ROLE_ADD,
        rewardData: { roleId: 'PLACEHOLDER', action: 'ADD' } as RoleRewardData,
        name: 'Voice Chatter',
        icon: '🎤',
        oneTime: true,
      },
      {
        level: 25,
        xpType: XPType.VOICE,
        rewardType: RewardType.VOICE_PRIORITY,
        rewardData: { permissions: ['PRIORITY_SPEAKER'] } as PermissionRewardData,
        name: 'Priority Speaker',
        icon: '📢',
        oneTime: true,
      },
    ],
  },
};
