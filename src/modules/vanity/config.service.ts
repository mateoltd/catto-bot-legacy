import type { VanityConfig } from '@prisma/client';
import { container } from '@sapphire/framework';

export const DEFAULT_THANK_YOU_MESSAGE =
  'Thanks {user} for supporting the server! You received {role}.';

export interface VanityConfigInput {
  enabled: boolean;
  keyword: string;
  roleId: string | null;
  thankYouEnabled: boolean;
  thankYouChannelId: string | null;
  thankYouMessage: string;
}

export type PublicVanityConfig = VanityConfigInput;

interface CacheEntry {
  value: VanityConfig | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const configCache = new Map<string, CacheEntry>();

export function defaultVanityConfig(): PublicVanityConfig {
  return {
    enabled: false,
    keyword: '',
    roleId: null,
    thankYouEnabled: false,
    thankYouChannelId: null,
    thankYouMessage: DEFAULT_THANK_YOU_MESSAGE,
  };
}

export function toPublicVanityConfig(config: VanityConfig | null): PublicVanityConfig {
  if (!config) return defaultVanityConfig();

  return {
    enabled: config.enabled,
    keyword: config.keyword,
    roleId: config.roleId,
    thankYouEnabled: config.thankYouEnabled,
    thankYouChannelId: config.thankYouChannelId,
    thankYouMessage: config.thankYouMessage,
  };
}

export async function getVanityConfig(
  guildId: string,
  bypassCache = false,
): Promise<VanityConfig | null> {
  if (!bypassCache) {
    const cached = configCache.get(guildId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;
  }

  const config = await container.prisma.vanityConfig.findUnique({
    where: { guildId },
  });
  configCache.set(guildId, { value: config, cachedAt: Date.now() });
  return config;
}

export async function updateVanityConfig(
  guildId: string,
  input: VanityConfigInput,
): Promise<VanityConfig> {
  const data: VanityConfigInput = {
    ...input,
    keyword: input.keyword.trim(),
    thankYouMessage: input.thankYouMessage.trim(),
  };

  const config = await container.prisma.vanityConfig.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });

  configCache.set(guildId, { value: config, cachedAt: Date.now() });
  return config;
}

export async function disableVanityConfig(guildId: string): Promise<VanityConfig | null> {
  const current = await getVanityConfig(guildId, true);
  if (!current) return null;

  const config = await container.prisma.vanityConfig.update({
    where: { guildId },
    data: { enabled: false },
  });
  configCache.set(guildId, { value: config, cachedAt: Date.now() });
  return config;
}

export async function preloadVanityConfigs(): Promise<number> {
  const configs = await container.prisma.vanityConfig.findMany();
  const cachedAt = Date.now();
  configCache.clear();
  for (const config of configs) configCache.set(config.guildId, { value: config, cachedAt });
  return configs.length;
}

export function invalidateVanityConfig(guildId: string): void {
  configCache.delete(guildId);
}

export function clearVanityConfigCache(): void {
  configCache.clear();
}
