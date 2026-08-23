/**
 * Reputation system models and types
 */

export enum VouchType {
  HELPFUL = 'helpful',
  FRIENDLY = 'friendly',
  SKILLED = 'skilled',
  RELIABLE = 'reliable',
}

export enum ReputationTier {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum',
  DIAMOND = 'Diamond',
}

export interface ReputationTierInfo {
  tier: ReputationTier;
  minScore: number;
  color: number;
  emoji: string;
  perks: string[];
}

export const REPUTATION_TIERS: Record<ReputationTier, ReputationTierInfo> = {
  [ReputationTier.BRONZE]: {
    tier: ReputationTier.BRONZE,
    minScore: 0,
    color: 0xcd7f32,
    emoji: '🥉',
    perks: ['Basic reputation tracking', 'Can vouch for others'],
  },
  [ReputationTier.SILVER]: {
    tier: ReputationTier.SILVER,
    minScore: 50,
    color: 0xc0c0c0,
    emoji: '🥈',
    perks: [
      'All Bronze perks',
      '+5% XP boost',
      'Vouch cooldown reduced to 12 hours',
      'Trusted role badge',
    ],
  },
  [ReputationTier.GOLD]: {
    tier: ReputationTier.GOLD,
    minScore: 150,
    color: 0xffd700,
    emoji: '🥇',
    perks: [
      'All Silver perks',
      '+10% XP boost',
      'Vouch cooldown reduced to 8 hours',
      'Priority temp voice channel creation',
      'Custom temp voice channel icon',
    ],
  },
  [ReputationTier.PLATINUM]: {
    tier: ReputationTier.PLATINUM,
    minScore: 300,
    color: 0xe5e4e2,
    emoji: '💎',
    perks: [
      'All Gold perks',
      '+15% XP boost',
      'Vouch cooldown reduced to 4 hours',
      'Auto-trusted in temp voice channels',
      'Reduced command cooldowns',
      'Special platinum name color',
    ],
  },
  [ReputationTier.DIAMOND]: {
    tier: ReputationTier.DIAMOND,
    minScore: 500,
    color: 0xb9f2ff,
    emoji: '💠',
    perks: [
      'All Platinum perks',
      '+25% XP boost',
      'No vouch cooldown',
      'Vouches worth 2x weight',
      'VIP temp voice features',
      'Custom bot responses',
      'Legendary status badge',
    ],
  },
};

export interface VouchData {
  giverUserId: string;
  receiverUserId: string;
  vouchType: VouchType;
  reason?: string;
  contextType?: 'voice' | 'text' | 'event';
  contextId?: string;
}

export interface ReputationStats {
  reputationScore: number;
  vouchesReceived: number;
  vouchesGiven: number;
  currentTier: ReputationTier;
  nextTier: ReputationTier | null;
  progressToNextTier: number;
  breakdown: {
    helpful: number;
    friendly: number;
    skilled: number;
    reliable: number;
  };
}

export interface VouchValidation {
  isValid: boolean;
  reason?: string;
  canVouchAgainAt?: Date;
}

// Anti-abuse constants
export const VOUCH_CONFIG = {
  // Cooldowns (in milliseconds)
  BASE_COOLDOWN: 24 * 60 * 60 * 1000, // 24 hours
  SILVER_COOLDOWN: 12 * 60 * 60 * 1000, // 12 hours
  GOLD_COOLDOWN: 8 * 60 * 60 * 1000, // 8 hours
  PLATINUM_COOLDOWN: 4 * 60 * 60 * 1000, // 4 hours
  DIAMOND_COOLDOWN: 0, // No cooldown

  // Same person cooldown (can't vouch same person too frequently)
  SAME_PERSON_COOLDOWN: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Account age requirements
  MIN_ACCOUNT_AGE_DAYS: 7, // Account must be 7 days old
  MIN_SERVER_AGE_DAYS: 3, // Must be in server for 3 days

  // Vouch weights
  BASE_WEIGHT: 1,
  SILVER_WEIGHT: 1,
  GOLD_WEIGHT: 2,
  PLATINUM_WEIGHT: 3,
  DIAMOND_WEIGHT: 5,

  // Reputation score values per vouch type
  VOUCH_POINTS: {
    [VouchType.HELPFUL]: 10,
    [VouchType.FRIENDLY]: 8,
    [VouchType.SKILLED]: 12,
    [VouchType.RELIABLE]: 15,
  },

  // Decay
  DECAY_AFTER_DAYS: 30, // Start decay after 30 days inactive
  DECAY_RATE: 0.05, // 5% decay per month inactive
};
