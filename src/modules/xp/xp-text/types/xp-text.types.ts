/**
 * XP/Leveling System Types
 */

// Enums
export enum XPMode {
  RANDOM = 'RANDOM',
  FIXED = 'FIXED',
}

export enum LevelCurveType {
  FORMULA = 'FORMULA',
  TABLE = 'TABLE',
}

export enum XPEventType {
  AWARD = 'AWARD',
  LEVEL_UP = 'LEVEL_UP',
  RESET = 'RESET',
  MANUAL_ADJUST = 'MANUAL_ADJUST',
}

// Guild XP Configuration Interface
export interface GuildXPConfig {
  id: string;
  guildId: string;
  enabled: boolean;

  // XP Award Settings
  cooldownSec: number;
  xpMode: XPMode;
  minXp: number;
  maxXp: number;
  fixedXp: number;
  minMessageLength: number;
  maxXpPerMinute: number | null;

  // Channel & Role Filters
  allowedChannels: string[];
  ignoredChannels: string[];
  ignoredRoles: string[];

  // Level-Up Announcements
  announceLevelUp: boolean;
  announceChannelId: string | null;
  messageTemplate: string;
  embedEnabled: boolean;
  embedColor: number;

  // Level Curve Configuration
  levelCurveType: LevelCurveType;
  formulaBase: number;
  formulaExponent: number;
  formulaOffset: number;
  tableThresholds: number[];

  createdAt: Date;
  updatedAt: Date;
}

// User XP Stats Interface
export interface UserXPStats {
  id: string;
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messageCount: number;
  lastAwardAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// XP Award Result
export interface XPAwardResult {
  awarded: boolean;
  reason?: string;
  xpGained?: number;
  newXp?: number;
  newLevel?: number;
  leveledUp?: boolean;
  previousLevel?: number;
}

// Level Calculation Result
export interface LevelCalculation {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number; // 0-1 percentage
  xpIntoLevel: number; // XP earned towards next level
}

// Leaderboard Entry
export interface LeaderboardEntry {
  userId: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  messageCount: number;
  rank: number;
}

// Leaderboard Response
export interface LeaderboardResponse {
  guildId: string;
  users: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
}

// User Stats Response (for API)
export interface UserStatsResponse {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  nextLevelXp: number;
  currentLevelXp: number;
  progress: number;
  xpIntoLevel: number;
  messageCount: number;
  lastAwardAt: Date | null;
  rank: number | null;
}

// XP Event Log Entry
export interface XPEventLog {
  id: string;
  guildId: string;
  userId: string;
  eventType: XPEventType;
  xpChange: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// Cache Entry
export interface ConfigCacheEntry {
  config: GuildXPConfig;
  cachedAt: number;
}

// Template Variables
export interface TemplateVariables {
  user: string;
  userId: string;
  username: string;
  level: number;
  xpGain: number;
  totalXp: number;
  nextLevelXp: number;
  progress: number;
  type: 'Text' | 'Voice';
}

// Validation Context
export interface ValidationContext {
  guildId: string;
  userId: string;
  channelId: string;
  messageContent: string;
  userRoles: string[];
  isBot: boolean;
  isDM: boolean;
}

// Recalculation Status
export interface RecalculationStatus {
  guildId: string;
  status: 'processing' | 'completed' | 'failed';
  totalUsers: number;
  processed: number;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}
