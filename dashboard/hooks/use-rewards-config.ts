'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  rewardsService,
  type Reward,
  type CreateReward,
  type UpdateReward,
  type RewardStats,
  type RewardTemplate,
  type UserRewardClaim,
} from '@/lib/services/rewards.service';

export function useRewardsConfig(guildId: string) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [templates, setTemplates] = useState<RewardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  const fetchRewards = useCallback(async () => {
    try {
      const data = await rewardsService.getRewards(guildId);
      if (mountedRef.current) {
        setRewards(data.rewards);
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    }
  }, [guildId]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await rewardsService.getStats(guildId);
      if (mountedRef.current) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch reward stats:', err);
    }
  }, [guildId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await rewardsService.getTemplates(guildId);
      if (mountedRef.current) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, [guildId]);

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [rewardsData, statsData, templatesData] = await Promise.allSettled([
          rewardsService.getRewards(guildId),
          rewardsService.getStats(guildId),
          rewardsService.getTemplates(guildId),
        ]);

        if (mountedRef.current) {
          if (rewardsData.status === 'fulfilled') {
            setRewards(rewardsData.value.rewards);
          }
          if (statsData.status === 'fulfilled') {
            setStats(statsData.value.stats);
          }
          if (templatesData.status === 'fulfilled') {
            setTemplates(templatesData.value.templates);
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch rewards data');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mountedRef.current = false;
    };
  }, [guildId]);

  const createReward = async (reward: CreateReward) => {
    try {
      setSaving(true);
      setError(null);
      const result = await rewardsService.createReward(guildId, reward);
      setRewards((prev) => [...prev, result.reward]);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create reward';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const updateReward = async (rewardId: string, updates: UpdateReward) => {
    try {
      setSaving(true);
      setError(null);
      const result = await rewardsService.updateReward(guildId, rewardId, updates);
      setRewards((prev) => prev.map((r) => (r.id === rewardId ? result.reward : r)));
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update reward';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const deleteReward = async (rewardId: string) => {
    try {
      setSaving(true);
      setError(null);
      await rewardsService.deleteReward(guildId, rewardId);
      setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete reward';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = async (templateName: string) => {
    try {
      setSaving(true);
      setError(null);
      const result = await rewardsService.applyTemplate(guildId, templateName);
      // Refresh rewards after applying template
      await fetchRewards();
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply template';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const getUserRewards = async (
    userId: string
  ): Promise<{ success: boolean; claims?: UserRewardClaim[]; error?: string }> => {
    try {
      const result = await rewardsService.getUserRewards(guildId, userId);
      return { success: true, claims: result.claims };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user rewards';
      return { success: false, error: errorMessage };
    }
  };

  return {
    rewards,
    stats,
    templates,
    loading,
    saving,
    error,
    createReward,
    updateReward,
    deleteReward,
    applyTemplate,
    getUserRewards,
    refetchRewards: fetchRewards,
    refetchStats: fetchStats,
    refetchTemplates: fetchTemplates,
  };
}
