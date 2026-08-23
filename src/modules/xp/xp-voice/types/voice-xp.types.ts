/**
 * Voice XP System Types
 */

import type { GuildVoiceXPConfig, UserVoiceXP, VoiceSession } from '@prisma/client';

// Enums
export enum VoiceXPMode {
  PER_MINUTE = 'PER_MINUTE',
  PER_SESSION = 'PER_SESSION',
}

export enum VoiceLevelCurveType {
  FORMULA = 'FORMULA',
  TABLE = 'TABLE',
}

export enum VoiceXPEventType {
  AWARD = 'AWARD',
  LEVEL_UP = 'LEVEL_UP',
  RESET = 'RESET',
  SESSION_END = 'SESSION_END',
  MANUAL_ADJUST = 'MANUAL_ADJUST',
}

// Voice State Context
export interface VoiceStateContext {
  guildId: string;
  userId: string;
  channelId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isStreaming: boolean;
  isVideo: boolean;
}

// Session Result
export interface SessionAwardResult {
  awarded: boolean;
  reason?: string;
  xpGained?: number;
  newXp?: number;
  newLevel?: number;
  leveledUp?: boolean;
  previousLevel?: number;
  durationMinutes?: number;
}

// Level Calculation Result
export interface VoiceLevelCalculation {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  xpIntoLevel: number;
}

// Leaderboard Entry
export interface VoiceLeaderboardEntry {
  userId: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  minutesInVoice: number;
  rank: number;
}

// Leaderboard Response
export interface VoiceLeaderboardResponse {
  guildId: string;
  users: VoiceLeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
}

// User Stats Response
export interface VoiceUserStatsResponse {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  nextLevelXp: number;
  currentLevelXp: number;
  progress: number;
  xpIntoLevel: number;
  minutesInVoice: number;
  lastAwardAt: Date | null;
  rank: number | null;
  currentSession?: VoiceSession;
}

// Cache Entry
export interface VoiceConfigCacheEntry {
  config: GuildVoiceXPConfig;
  cachedAt: number;
}

// Session Tracking
export interface ActiveSession {
  guildId: string;
  userId: string;
  channelId: string;
  joinedAt: number;
  sessionId: string;
  lastAwardTime: number;
  isMuted: boolean;
  isDeafened: boolean;
  isStreaming: boolean;
  isVideo: boolean;
}

// Template Variables
export interface VoiceTemplateVariables {
  user: string;
  userId: string;
  username: string;
  level: number;
  xpGain: number;
  totalXp: number;
  minutesInVoice: number;
  nextLevelXp: number;
  progress: number;
  type: 'Text' | 'Voice';
}

// Validation Context
export interface VoiceValidationContext {
  guildId: string;
  userId: string;
  channelId: string;
  userRoles: string[];
  isMuted: boolean;
  isDeafened: boolean;
  isStreaming: boolean;
  isVideo: boolean;
  isAfkChannel: boolean;
}

export type { GuildVoiceXPConfig, UserVoiceXP, VoiceSession };
