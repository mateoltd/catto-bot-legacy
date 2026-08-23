/**
 * Shared types for image generation (Rust image-gen-rs microservice)
 */

export type BonkStyle = 'doge' | 'cat' | 'lions' | 'rabbit' | 'doge_fatality' | 'capybara';

export interface BonkVisualConfig {
  bonkText: string;
  fontSize: number;
  starCount: number;
  showSpeedLines: boolean;
  showDamageNumber: boolean;
  textColor: string;
  glowColor: string;
  textStrokeWidth: number;
}

export interface BonkImageData {
  bonkerAvatarUrl: string;
  bonkedAvatarUrl: string;
  style: BonkStyle;
  visuals?: BonkVisualConfig;
}

export interface RankCardData {
  username: string;
  discriminator?: string;
  avatarUrl: string;
  level: number;
  currentXP: number;
  requiredXP: number;
  rank: number;
  totalMembers: number;
  accentColor?: string;
  backgroundColor?: string;
  messagesXP?: number;
  voiceXP?: number;
  reactionsXP?: number;
  commandsXP?: number;
  mostActiveChannel?: string;
  last7DaysXP?: number;
  last30DaysXP?: number;
  streak?: number;
  memberSince?: string;
  isVoiceCard?: boolean;
}

export interface LeaderboardCardData {
  guildName: string;
  guildIcon?: string;
  entries: {
    rank: number;
    username: string;
    avatarUrl: string;
    level: number;
    xp: number;
  }[];
  accentColor?: string;
  totalMembers?: number;
  totalXp?: number;
  weeklyXp?: number;
}
