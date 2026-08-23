/**
 * Voice XP Configuration Service
 * Manages voice XP configuration with caching
 */

import type { GuildVoiceXPConfig } from '@prisma/client';
import type { UpdateVoiceXPConfigDTO } from '../dtos/index.js';
import type { VoiceConfigCacheEntry } from '../types/voice-xp.types.js';
import * as voiceXPConfigRepository from '../repositories/voice-xp-config.repository.js';
import { voiceXPQueue } from './voice-xp-queue.service.js';
import { recalculateGuildVoiceLevels } from './voice-level-calculator.service.js';
import { container } from '@sapphire/framework';

const configCache = new Map<string, VoiceConfigCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const recalcInFlight = new Set<string>();

export async function getVoiceXPConfig(
  guildId: string,
  skipCache = false
): Promise<GuildVoiceXPConfig> {
  if (!skipCache) {
    const cached = configCache.get(guildId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.config;
    }
  }

  const config = await voiceXPConfigRepository.getVoiceXPConfig(guildId);

  configCache.set(guildId, {
    config,
    cachedAt: Date.now(),
  });

  return config;
}

export async function updateVoiceXPConfig(
  guildId: string,
  data: UpdateVoiceXPConfigDTO
): Promise<GuildVoiceXPConfig> {
  const oldConfig = await voiceXPConfigRepository.getVoiceXPConfig(guildId);
  const config = await voiceXPConfigRepository.updateVoiceXPConfig(guildId, data);

  configCache.set(guildId, {
    config,
    cachedAt: Date.now(),
  });

  // Handle queue scheduling when XP mode changes
  if (config.enabled && config.xpMode === 'PER_MINUTE') {
    // Schedule if newly enabled or switched to PER_MINUTE
    if (!oldConfig.enabled || oldConfig.xpMode !== 'PER_MINUTE') {
      await voiceXPQueue.scheduleGuildAwards(guildId);
    }
  } else {
    // Unschedule if disabled or switched to PER_SESSION
    if (oldConfig.xpMode === 'PER_MINUTE') {
      await voiceXPQueue.unscheduleGuildAwards(guildId);
    }
  }

  // Recalculate levels in the background if curve parameters changed
  const curveChanged =
    oldConfig.levelCurveType !== config.levelCurveType ||
    oldConfig.formulaBase !== config.formulaBase ||
    oldConfig.formulaExponent !== config.formulaExponent ||
    oldConfig.formulaOffset !== config.formulaOffset ||
    JSON.stringify(oldConfig.tableThresholds) !== JSON.stringify(config.tableThresholds);

  if (curveChanged && !recalcInFlight.has(guildId)) {
    recalcInFlight.add(guildId);
    container.logger.info(
      `[Voice XP] Curve parameters changed for guild ${guildId}, recalculating levels...`
    );
    recalculateGuildVoiceLevels(guildId, config)
      .then(({ processed, updated }) => {
        container.logger.info(
          `[Voice XP] Recalculation complete for guild ${guildId}: ${processed} processed, ${updated} updated`
        );
      })
      .catch((error) => {
        container.logger.error(`[Voice XP] Recalculation failed for guild ${guildId}:`, error);
      })
      .finally(() => {
        recalcInFlight.delete(guildId);
      });
  }

  return config;
}

export async function deleteVoiceXPConfig(guildId: string): Promise<void> {
  await voiceXPConfigRepository.deleteVoiceXPConfig(guildId);
  configCache.delete(guildId);
}

export async function isVoiceXPEnabled(guildId: string): Promise<boolean> {
  const config = await getVoiceXPConfig(guildId);
  return config.enabled;
}

export function clearVoiceConfigCache(guildId?: string): void {
  if (guildId) {
    configCache.delete(guildId);
  } else {
    configCache.clear();
  }
}
