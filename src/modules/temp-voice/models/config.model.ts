/**
 * TypeScript interfaces for Temp Voice configuration
 */

import type { OwnerLeaveStrategy } from '../constants.js';
import type { TempVoiceNamingScheme, TempVoiceModerationAction } from '@prisma/client';

/**
 * Guild-level configuration for temp voice module
 */
export interface TempVoiceConfig {
  id: string;
  guildId: string;
  enabled: boolean;

  // Join to Create channels
  joinToCreateChannels: string[];

  // Creation settings
  categoryId: string | null;
  fallbackCategoryId: string | null;
  namingScheme: TempVoiceNamingScheme;
  defaultNameTemplate: string;

  // Default channel settings
  defaultUserLimit: number;
  defaultBitrate: number | null;
  defaultRegion: string | null;
  defaultLocked: boolean;
  defaultHidden: boolean;

  // Cleanup settings
  deleteDelaySeconds: number;
  ownerLeaveStrategy: OwnerLeaveStrategy;

  // Anti-abuse
  cooldownSeconds: number;
  maxChannelsPerUser: number;

  // Control panel
  controlPanelEnabled: boolean;
  controlPanelOnCreate: boolean;
  allowCustomization: boolean;

  // Logging
  logChannelId: string | null;
  logWebhook: string | null;

  // Permissions
  adminRoleIds: string[];

  // Name Moderation (optional, disabled by default)
  moderationEnabled: boolean;
  moderationAction: TempVoiceModerationAction;
  strictMode: boolean;
  allowListEnabled: boolean;
  customPatterns: string[];
  allowedKeywords: string[];

  // Multi-language settings
  primaryLanguage: string;
  additionalLanguages: string[];
  multiLangMode: boolean;
  languageSettings: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial config for updates (all fields optional except guildId)
 */
export type TempVoiceConfigUpdate = Partial<
  Omit<TempVoiceConfig, 'id' | 'createdAt' | 'updatedAt' | 'guildId'>
>;

/**
 * Config input for creation/update (without system fields)
 */
export type TempVoiceConfigInput = Omit<
  TempVoiceConfig,
  'id' | 'createdAt' | 'updatedAt' | 'guildId'
>;
