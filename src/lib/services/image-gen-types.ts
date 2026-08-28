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
  avatarUrl: string;
  cardType: 'text' | 'voice';
  totalXP: number;
  level: number;
  currentXP: number;
  requiredXP: number;
  maxLevel: boolean;
  rank: number;
  primaryValue: number;
  secondaryValue: number;
  mostActiveChannel?: string;
  activityState: 'available' | 'none' | 'unavailable';
  last7DaysValue: number;
  streak: number;
  memberSince: string;
}

export interface LeaderboardCardData {
  guildName: string;
  entries: {
    rank: number;
    username: string;
    avatarUrl?: string;
    level: number;
    xp: number;
  }[];
  totalMembers: number;
  totalXp: number;
  weeklyXp: number;
}
