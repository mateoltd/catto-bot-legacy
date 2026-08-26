"use client";

import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import useSWR from "swr";
import {
  tempVoiceService,
  type TempVoiceConfig,
  type TempVoiceConfigUpdate,
  type TempVoiceChannel,
  type TempVoiceStats,
  type TempVoiceSetupRequest,
} from "@/lib/services/temp-voice.service";

/** Local editable fields tracked for dirty detection */
export interface LocalTempVoiceConfig {
  namingScheme: "username" | "displayname" | "sequential" | "custom";
  customNamingPattern: string;
  userLimit: number | null;
  bitrate: number | null;
  maxChannelsPerUser: number;
  defaultLocked: boolean;
  defaultHidden: boolean;
  deleteEmptyAfterMs: number;
  controlPanelEnabled: boolean;
  allowOwnerManagement: boolean;
  enableNameModeration: boolean;
  blockedKeywords: string[];
}

function buildLocalConfig(
  config: TempVoiceConfig | null,
): LocalTempVoiceConfig {
  return {
    namingScheme: config?.namingScheme || "username",
    customNamingPattern: config?.customNamingPattern || "{username}'s Channel",
    userLimit: config?.userLimit || null,
    bitrate: config ? config.bitrate : 64_000,
    maxChannelsPerUser: config?.maxChannelsPerUser || 3,
    defaultLocked: config?.defaultLocked ?? false,
    defaultHidden: config?.defaultHidden ?? false,
    deleteEmptyAfterMs: config?.deleteEmptyAfterMs ?? 5_000,
    controlPanelEnabled: config?.controlPanelEnabled ?? true,
    allowOwnerManagement: config?.allowOwnerManagement ?? true,
    enableNameModeration: config?.enableNameModeration ?? false,
    blockedKeywords: config?.blockedKeywords ?? [],
  };
}

interface TempVoiceDashboardData {
  config: TempVoiceConfig | null;
  channels: TempVoiceChannel[];
  stats: TempVoiceStats | null;
}

export function useTempVoiceConfig(guildId: string) {
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    data,
    error: queryError,
    isLoading,
    mutate,
  } = useSWR<TempVoiceDashboardData>(
    ["temp-voice-dashboard", guildId],
    async () => {
      const config = await tempVoiceService.getConfig(guildId);
      if (!config) return { config: null, channels: [], stats: null };

      const [channelsData, stats] = await Promise.all([
        tempVoiceService
          .getChannels(guildId)
          .catch(() => ({ guildId, totalChannels: 0, channels: [] })),
        tempVoiceService.getStats(guildId).catch(() => null),
      ]);
      return { config, channels: channelsData.channels, stats };
    },
    { revalidateOnFocus: false },
  );
  const config = data?.config ?? null;
  const channels = data?.channels ?? [];
  const stats = data?.stats ?? null;

  const setConfig = (nextConfig: TempVoiceConfig | null) =>
    mutate(
      (current) => ({
        config: nextConfig,
        channels: nextConfig ? (current?.channels ?? []) : [],
        stats: nextConfig ? (current?.stats ?? null) : null,
      }),
      { revalidate: false },
    );

  // Local editable config state
  const [localConfigDraft, setLocalConfigDraft] =
    useState<LocalTempVoiceConfig | null>(null);
  const serverLocalConfig = useMemo(() => buildLocalConfig(config), [config]);
  const localConfig = localConfigDraft ?? serverLocalConfig;
  const setLocalConfig: Dispatch<SetStateAction<LocalTempVoiceConfig>> = (
    value,
  ) => {
    setLocalConfigDraft((current) => {
      const previous = current ?? serverLocalConfig;
      return typeof value === "function" ? value(previous) : value;
    });
  };

  // Dirty tracking: compare localConfig to server config
  const isDirty = useMemo(() => {
    if (!config) return false;
    const server = buildLocalConfig(config);
    return (
      server.namingScheme !== localConfig.namingScheme ||
      server.customNamingPattern !== localConfig.customNamingPattern ||
      server.userLimit !== localConfig.userLimit ||
      server.bitrate !== localConfig.bitrate ||
      server.maxChannelsPerUser !== localConfig.maxChannelsPerUser ||
      server.defaultLocked !== localConfig.defaultLocked ||
      server.defaultHidden !== localConfig.defaultHidden ||
      server.deleteEmptyAfterMs !== localConfig.deleteEmptyAfterMs ||
      server.controlPanelEnabled !== localConfig.controlPanelEnabled ||
      server.allowOwnerManagement !== localConfig.allowOwnerManagement ||
      server.enableNameModeration !== localConfig.enableNameModeration ||
      JSON.stringify(server.blockedKeywords) !==
        JSON.stringify(localConfig.blockedKeywords)
    );
  }, [config, localConfig]);

  const updateConfig = async (updates: TempVoiceConfigUpdate) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await tempVoiceService.updateConfig(guildId, updates);
      setConfig(result);
      setLocalConfigDraft(null);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const createConfig = async (configData: TempVoiceConfigUpdate) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await tempVoiceService.createConfig(guildId, configData);
      setConfig(result);
      setLocalConfigDraft(null);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async () => {
    try {
      setSaving(true);
      setMutationError(null);
      await tempVoiceService.deleteConfig(guildId);
      setConfig(null);
      setLocalConfigDraft(null);
      return { success: true };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const setup = async (options: TempVoiceSetupRequest) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await tempVoiceService.setup(guildId, options);
      // Setup returns data.config
      setConfig(result.config);
      setLocalConfigDraft(null);
      return { success: true, data: result };
    } catch (err) {
      // Check if this is a 409 Conflict (config already exists)
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const errorMessage = getErrorMessage(err);
      const isAlreadyExists =
        status === 409 || errorMessage.toLowerCase().includes("already exists");

      if (isAlreadyExists) {
        // Config already exists - refetch it instead of showing error
        try {
          const existingConfig = await tempVoiceService.getConfig(guildId);
          if (existingConfig) {
            setConfig(existingConfig);
            setLocalConfigDraft(null);
            setMutationError(null);

            // Also fetch channels and stats
            const [channelsData, statsData] = await Promise.all([
              tempVoiceService
                .getChannels(guildId)
                .catch(() => ({ guildId, totalChannels: 0, channels: [] })),
              tempVoiceService.getStats(guildId).catch(() => null),
            ]);
            await mutate(
              {
                config: existingConfig,
                channels: channelsData.channels,
                stats: statsData,
              },
              { revalidate: false },
            );

            return { success: true, data: { config: existingConfig } };
          }
        } catch {
          // Fall through to error handling
        }
      }

      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const addJoinChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await tempVoiceService.addJoinChannel(guildId, channelId);
      if (config) {
        setConfig({ ...config, joinChannelIds: result.joinChannelIds });
      }
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const removeJoinChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await tempVoiceService.removeJoinChannel(
        guildId,
        channelId,
      );
      if (config) {
        setConfig({ ...config, joinChannelIds: result.joinChannelIds });
      }
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  return {
    config,
    channels,
    stats,
    loading: isLoading,
    saving,
    error: mutationError ?? (queryError ? getErrorMessage(queryError) : null),
    isDirty,
    localConfig,
    setLocalConfig,
    updateConfig,
    createConfig,
    deleteConfig,
    setup,
    addJoinChannel,
    removeJoinChannel,
    refetch: () => mutate(),
    setConfig,
  };
}

// Helper to extract error message from various error types
function getErrorMessage(err: unknown): string {
  // Axios error with response
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    err.response &&
    typeof err.response === "object"
  ) {
    const response = err.response as {
      data?: { error?: { message?: string }; message?: string };
    };
    if (response.data?.error?.message) {
      return response.data.error.message;
    }
    if (response.data?.message) {
      return response.data.message;
    }
  }
  // Standard Error
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}
