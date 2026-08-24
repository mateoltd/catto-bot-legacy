'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  rewardsService,
  type CreateReward,
  type UpdateReward,
} from '@/lib/services/rewards.service';

export function useRewardsConfig(guildId: string) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rewardsQuery = useSWR(
    ['rewards', guildId],
    () => rewardsService.getRewards(guildId),
    { revalidateOnFocus: false },
  );
  const statsQuery = useSWR(
    ['reward-stats', guildId],
    () => rewardsService.getStats(guildId),
    { revalidateOnFocus: false },
  );
  const templatesQuery = useSWR(
    ['reward-templates', guildId],
    () => rewardsService.getTemplates(guildId),
    { revalidateOnFocus: false },
  );

  const createReward = async (reward: CreateReward) => {
    try {
      setSaving(true);
      setError(null);
      const result = await rewardsService.createReward(guildId, reward);
      await rewardsQuery.mutate(
        (current) => current && { ...current, rewards: [...current.rewards, result.reward] },
        { revalidate: false },
      );
      void statsQuery.mutate();
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
      await rewardsQuery.mutate(
        (current) =>
          current && {
            ...current,
            rewards: current.rewards.map((reward) =>
              reward.id === rewardId ? result.reward : reward,
            ),
          },
        { revalidate: false },
      );
      void statsQuery.mutate();
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
      await rewardsQuery.mutate(
        (current) =>
          current && {
            ...current,
            rewards: current.rewards.filter((reward) => reward.id !== rewardId),
          },
        { revalidate: false },
      );
      void statsQuery.mutate();
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
      await rewardsQuery.mutate();
      void statsQuery.mutate();
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply template';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  return {
    rewards: rewardsQuery.data?.rewards ?? [],
    stats: statsQuery.data?.stats ?? null,
    templates: templatesQuery.data?.templates ?? [],
    loading: rewardsQuery.isLoading || statsQuery.isLoading || templatesQuery.isLoading,
    saving,
    error,
    createReward,
    updateReward,
    deleteReward,
    applyTemplate,
    refetchRewards: () => rewardsQuery.mutate(),
    refetchStats: () => statsQuery.mutate(),
    refetchTemplates: () => templatesQuery.mutate(),
  };
}
