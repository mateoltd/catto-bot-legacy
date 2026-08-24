import { botApi } from '@/lib/api';

// Types
export type XpType = 'TEXT' | 'VOICE' | 'BOTH';

// Must match backend RewardType enum from src/lib/types/rewards.types.ts
export type RewardType =
  | 'ROLE_ADD'
  | 'ROLE_REMOVE'
  | 'ROLE_STACK'
  | 'ROLE_REPLACE'
  | 'PERMISSION_GRANT'
  | 'PERMISSION_REVOKE'
  | 'CHANNEL_ACCESS'
  | 'CHANNEL_REVOKE'
  | 'CATEGORY_ACCESS'
  | 'CURRENCY_GRANT'
  | 'CURRENCY_MULTIPLIER'
  | 'XP_MULTIPLIER'
  | 'XP_BONUS'
  | 'DOUBLE_XP_TOKEN'
  | 'NICKNAME_UNLOCK'
  | 'COLOR_UNLOCK'
  | 'CUSTOM_STATUS'
  | 'PROFILE_BADGE'
  | 'COMMAND_UNLOCK'
  | 'FEATURE_UNLOCK'
  | 'EMBED_UNLOCK'
  | 'VOICE_PRIORITY'
  | 'VOICE_SOUNDBOARD'
  | 'VOICE_ACTIVITY'
  | 'CUSTOM_REWARD'
  | 'WEBHOOK_TRIGGER'
  | 'ANNOUNCEMENT';

export interface RewardData {
  roleId?: string;
  action?: 'ADD' | 'REMOVE' | 'STACK' | 'REPLACE';
  amount?: number;
  multiplier?: number;
  channelIds?: string[];
  permissions?: string[];
  message?: string;
  [key: string]: unknown;
}

export interface Reward {
  id: string;
  guildId: string;
  level: number;
  xpType: XpType;
  rewardType: RewardType;
  rewardData: RewardData;
  name: string;
  description: string | null;
  icon: string | null;
  oneTime: boolean;
  stackable: boolean;
  requiresPrevious: boolean;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReward {
  level: number;
  xpType: XpType;
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

export interface UpdateReward {
  level?: number;
  xpType?: XpType;
  rewardType?: RewardType;
  rewardData?: RewardData;
  name?: string;
  description?: string;
  icon?: string;
  oneTime?: boolean;
  stackable?: boolean;
  requiresPrevious?: boolean;
  priority?: number;
  enabled?: boolean;
}

export interface RewardsResponse {
  success: boolean;
  count: number;
  rewards: Reward[];
}

export interface RewardResponse {
  success: boolean;
  reward: Reward;
}

export interface RewardsQuery {
  type?: XpType;
  enabled?: boolean;
}

export interface RewardStats {
  totalRewards: number;
  enabledRewards: number;
  disabledRewards: number;
  byXpType: {
    TEXT: number;
    VOICE: number;
    BOTH: number;
  };
  byRewardType: Record<string, number>;
  totalClaims: number;
  mostClaimedRewards: {
    id: string;
    name: string;
    level: number;
    claims: number;
  }[];
  levelDistribution: Record<string, number>;
}

export interface RewardStatsResponse {
  success: boolean;
  stats: RewardStats;
}

export interface RewardTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  rewardCount: number;
}

export interface TemplatesResponse {
  success: boolean;
  count: number;
  templates: RewardTemplate[];
}

export interface ApplyTemplateResponse {
  success: boolean;
  template: {
    name: string;
    description: string;
    category: string;
  };
  created: number;
  rewards: Reward[];
}

export const rewardsService = {
  /**
   * Get all rewards for a guild
   */
  async getRewards(guildId: string, query?: RewardsQuery): Promise<RewardsResponse> {
    const params = new URLSearchParams();
    if (query?.type) params.append('type', query.type);
    if (query?.enabled !== undefined) params.append('enabled', query.enabled.toString());
    const queryString = params.toString();
    const response = await botApi.get(
      `/api/guilds/${guildId}/rewards${queryString ? `?${queryString}` : ''}`
    );
    return response.data;
  },

  /**
   * Create a new reward
   */
  async createReward(guildId: string, reward: CreateReward): Promise<RewardResponse> {
    const response = await botApi.post(`/api/guilds/${guildId}/rewards`, reward);
    return response.data;
  },

  /**
   * Get a specific reward
   */
  async getReward(guildId: string, rewardId: string): Promise<RewardResponse> {
    const response = await botApi.get(`/api/guilds/${guildId}/rewards/${rewardId}`);
    return response.data;
  },

  /**
   * Update a reward
   */
  async updateReward(
    guildId: string,
    rewardId: string,
    updates: UpdateReward
  ): Promise<RewardResponse> {
    const response = await botApi.patch(`/api/guilds/${guildId}/rewards/${rewardId}`, updates);
    return response.data;
  },

  /**
   * Delete a reward
   */
  async deleteReward(
    guildId: string,
    rewardId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await botApi.delete(`/api/guilds/${guildId}/rewards/${rewardId}`);
    return response.data;
  },

  /**
   * Get reward statistics for a guild
   */
  async getStats(guildId: string): Promise<RewardStatsResponse> {
    const response = await botApi.get(`/api/guilds/${guildId}/rewards/stats`);
    return response.data;
  },

  /**
   * Get available reward templates
   */
  async getTemplates(guildId: string): Promise<TemplatesResponse> {
    const response = await botApi.get(`/api/guilds/${guildId}/rewards/templates`);
    return response.data;
  },

  /**
   * Apply a reward template to a guild
   */
  async applyTemplate(guildId: string, templateName: string): Promise<ApplyTemplateResponse> {
    const response = await botApi.post(`/api/guilds/${guildId}/rewards/templates/${templateName}`);
    return response.data;
  },
};
