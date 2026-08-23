'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  tempVoiceService,
  type TempVoiceConfig,
  type TempVoiceConfigUpdate,
  type TempVoiceChannel,
  type TempVoiceStats,
  type TempVoiceSetupRequest,
  type OwnerLeaveStrategy,
} from '@/lib/services/temp-voice.service';

/** Local editable fields tracked for dirty detection */
export interface LocalTempVoiceConfig {
  namingScheme: 'username' | 'displayname' | 'sequential' | 'custom';
  customNamingPattern: string;
  userLimit: number | null;
  bitrate: number | null;
  maxChannelsPerUser: number;
  defaultLocked: boolean;
  defaultHidden: boolean;
  ownerLeaveStrategy: OwnerLeaveStrategy;
  autoDeleteEmpty: boolean;
  deleteEmptyAfterMs: number;
  autoDeleteOwnerLeave: boolean;
  deleteOwnerLeaveAfterMs: number;
  allowOwnerTransfer: boolean;
  allowOwnerManagement: boolean;
  enableNameModeration: boolean;
  blockedKeywords: string[];
}

function buildLocalConfig(config: TempVoiceConfig | null): LocalTempVoiceConfig {
  return {
    namingScheme: config?.namingScheme || 'username',
    customNamingPattern: config?.customNamingPattern || "{username}'s Channel",
    userLimit: config?.userLimit || null,
    bitrate: config?.bitrate || null,
    maxChannelsPerUser: config?.maxChannelsPerUser || 1,
    defaultLocked: config?.defaultLocked ?? false,
    defaultHidden: config?.defaultHidden ?? false,
    ownerLeaveStrategy: config?.ownerLeaveStrategy || 'TRANSFER',
    autoDeleteEmpty: config?.autoDeleteEmpty ?? true,
    deleteEmptyAfterMs: config?.deleteEmptyAfterMs || 60000,
    autoDeleteOwnerLeave: config?.autoDeleteOwnerLeave ?? false,
    deleteOwnerLeaveAfterMs: config?.deleteOwnerLeaveAfterMs || 300000,
    allowOwnerTransfer: config?.allowOwnerTransfer ?? true,
    allowOwnerManagement: config?.allowOwnerManagement ?? true,
    enableNameModeration: config?.enableNameModeration ?? false,
    blockedKeywords: config?.blockedKeywords ?? [],
  };
}

export function useTempVoiceConfig(guildId: string) {
  const [config, setConfig] = useState<TempVoiceConfig | null>(null);
  const [channels, setChannels] = useState<TempVoiceChannel[]>([]);
  const [stats, setStats] = useState<TempVoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  // Local editable config state
  const [localConfig, setLocalConfig] = useState<LocalTempVoiceConfig>(() =>
    buildLocalConfig(null)
  );

  // Sync localConfig when server config changes (e.g., after setup or fetch)
  useEffect(() => {
    if (config) {
      setLocalConfig(buildLocalConfig(config));
    }
  }, [config]);

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
      server.ownerLeaveStrategy !== localConfig.ownerLeaveStrategy ||
      server.autoDeleteEmpty !== localConfig.autoDeleteEmpty ||
      server.deleteEmptyAfterMs !== localConfig.deleteEmptyAfterMs ||
      server.autoDeleteOwnerLeave !== localConfig.autoDeleteOwnerLeave ||
      server.deleteOwnerLeaveAfterMs !== localConfig.deleteOwnerLeaveAfterMs ||
      server.allowOwnerTransfer !== localConfig.allowOwnerTransfer ||
      server.allowOwnerManagement !== localConfig.allowOwnerManagement ||
      server.enableNameModeration !== localConfig.enableNameModeration ||
      JSON.stringify(server.blockedKeywords) !== JSON.stringify(localConfig.blockedKeywords)
    );
  }, [config, localConfig]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch config first, then channels and stats only if config exists
      const configData = await tempVoiceService.getConfig(guildId);

      if (!mountedRef.current) return;
      setConfig(configData);

      if (configData) {
        // Config exists, fetch channels and stats
        const [channelsData, statsData] = await Promise.all([
          tempVoiceService
            .getChannels(guildId)
            .catch(() => ({ guildId, totalChannels: 0, channels: [] })),
          tempVoiceService.getStats(guildId).catch(() => null),
        ]);
        if (mountedRef.current) {
          setChannels(channelsData.channels);
          setStats(statsData);
        }
      } else {
        // No config, reset channels and stats
        if (mountedRef.current) {
          setChannels([]);
          setStats(null);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const message = getErrorMessage(err);

      // If error says config already exists, try to fetch it directly
      if (message.toLowerCase().includes('already exists')) {
        try {
          const existingConfig = await tempVoiceService.getConfig(guildId);
          if (mountedRef.current && existingConfig) {
            setConfig(existingConfig);
            setError(null);
            return;
          }
        } catch {
          // Fall through to normal error handling
        }
      }

      // Don't show error if config just doesn't exist
      if (!message.includes('404') && !message.includes('not found')) {
        setError(message);
      }
      // Keep config as null so setup wizard shows
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [guildId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchAll]);

  const updateConfig = async (updates: TempVoiceConfigUpdate) => {
    try {
      setSaving(true);
      setError(null);
      const result = await tempVoiceService.updateConfig(guildId, updates);
      setConfig(result);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const createConfig = async (configData: TempVoiceConfigUpdate) => {
    try {
      setSaving(true);
      setError(null);
      const result = await tempVoiceService.createConfig(guildId, configData);
      setConfig(result);
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      await tempVoiceService.deleteConfig(guildId);
      setConfig(null);
      return { success: true };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const setup = async (options: TempVoiceSetupRequest) => {
    try {
      setSaving(true);
      setError(null);
      const result = await tempVoiceService.setup(guildId, options);
      // Setup returns data.config
      setConfig(result.config);
      return { success: true, data: result };
    } catch (err) {
      // Check if this is a 409 Conflict (config already exists)
      const status = (err as { response?: { status?: number } })?.response?.status;
      const errorMessage = getErrorMessage(err);
      const isAlreadyExists =
        status === 409 || errorMessage.toLowerCase().includes('already exists');

      if (isAlreadyExists) {
        // Config already exists - refetch it instead of showing error
        try {
          const existingConfig = await tempVoiceService.getConfig(guildId);
          if (existingConfig) {
            setConfig(existingConfig);
            setError(null); // Clear any previous errors

            // Also fetch channels and stats
            const [channelsData, statsData] = await Promise.all([
              tempVoiceService
                .getChannels(guildId)
                .catch(() => ({ guildId, totalChannels: 0, channels: [] })),
              tempVoiceService.getStats(guildId).catch(() => null),
            ]);
            setChannels(channelsData.channels);
            setStats(statsData);

            return { success: true, data: { config: existingConfig } };
          }
        } catch {
          // Fall through to error handling
        }
      }

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const addJoinChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setError(null);
      const result = await tempVoiceService.addJoinChannel(guildId, channelId);
      if (config) {
        setConfig({ ...config, joinChannelIds: result.joinChannelIds });
      }
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const removeJoinChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setError(null);
      const result = await tempVoiceService.removeJoinChannel(guildId, channelId);
      if (config) {
        setConfig({ ...config, joinChannelIds: result.joinChannelIds });
      }
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  return {
    config,
    channels,
    stats,
    loading,
    saving,
    error,
    isDirty,
    localConfig,
    setLocalConfig,
    updateConfig,
    createConfig,
    deleteConfig,
    setup,
    addJoinChannel,
    removeJoinChannel,
    refetch: fetchAll,
    setConfig,
  };
}

// Helper to extract error message from various error types
function getErrorMessage(err: unknown): string {
  // Axios error with response
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object'
  ) {
    const response = err.response as { data?: { error?: { message?: string }; message?: string } };
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
  return 'An unexpected error occurred';
}
