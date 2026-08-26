import { TempVoiceNamingScheme } from "@prisma/client";
import type {
  TempVoiceConfig,
  TempVoiceConfigInput,
  TempVoiceConfigUpdate,
} from "../models/config.model.js";
import { DEFAULT_TEMP_VOICE_CONFIG } from "../constants.js";
import { TEMP_VOICE_OWNERSHIP_GRACE_MS } from "../domain/temp-voice.types.js";

export interface TempVoiceConfigApiInput {
  enabled?: boolean;
  joinChannelIds?: string[];
  namingScheme?: "username" | "custom" | "displayname" | "sequential";
  customNamingPattern?: string | null;
  userLimit?: number | null;
  bitrate?: number | null;
  defaultCategoryId?: string | null;
  defaultLocked?: boolean;
  defaultHidden?: boolean;
  deleteEmptyAfterMs?: number;
  controlPanelEnabled?: boolean;
  allowOwnerManagement?: boolean;
  maxChannelsPerUser?: number;
  logChannelId?: string | null;
  logWebhook?: string | null;
  enableNameModeration?: boolean;
  blockedKeywords?: string[];
}

function mapNamingSchemeToDb(
  scheme: NonNullable<TempVoiceConfigApiInput["namingScheme"]>,
): TempVoiceNamingScheme {
  return {
    username: TempVoiceNamingScheme.USERNAME,
    displayname: TempVoiceNamingScheme.DISPLAYNAME,
    sequential: TempVoiceNamingScheme.SEQUENTIAL,
    custom: TempVoiceNamingScheme.CUSTOM,
  }[scheme];
}

function mapNamingSchemeFromDb(
  scheme: TempVoiceNamingScheme,
): NonNullable<TempVoiceConfigApiInput["namingScheme"]> {
  return {
    [TempVoiceNamingScheme.USERNAME]: "username" as const,
    [TempVoiceNamingScheme.DISPLAYNAME]: "displayname" as const,
    [TempVoiceNamingScheme.SEQUENTIAL]: "sequential" as const,
    [TempVoiceNamingScheme.CUSTOM]: "custom" as const,
  }[scheme];
}

export function mapConfigToApiResponse(config: TempVoiceConfig) {
  return {
    guildId: config.guildId,
    enabled: config.enabled,
    joinChannelIds: config.joinToCreateChannels,
    namingScheme: mapNamingSchemeFromDb(config.namingScheme),
    customNamingPattern: config.defaultNameTemplate,
    userLimit: config.defaultUserLimit,
    bitrate:
      config.defaultBitrate === null ? null : config.defaultBitrate * 1_000,
    defaultCategoryId: config.categoryId,
    defaultLocked: config.defaultLocked,
    defaultHidden: config.defaultHidden,
    autoDeleteEmpty: true,
    deleteEmptyAfterMs: config.deleteDelaySeconds * 1000,
    ownershipGraceSeconds: TEMP_VOICE_OWNERSHIP_GRACE_MS / 1_000,
    allowOwnerTransfer: true,
    controlPanelEnabled: config.controlPanelEnabled,
    allowOwnerManagement: config.allowCustomization,
    maxChannelsPerUser: config.maxChannelsPerUser,
    logChannelId: config.logChannelId,
    logWebhook: config.logWebhook,
    enableNameModeration: config.moderationEnabled,
    blockedKeywords: config.customPatterns,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function mapApiInputToCreateData(
  data: TempVoiceConfigApiInput,
): Partial<TempVoiceConfigInput> {
  return {
    enabled: data.enabled,
    joinToCreateChannels: data.joinChannelIds || [],
    namingScheme: data.namingScheme
      ? mapNamingSchemeToDb(data.namingScheme)
      : TempVoiceNamingScheme.USERNAME,
    defaultNameTemplate: data.customNamingPattern || "{username}'s Channel",
    defaultUserLimit: data.userLimit ?? 0,
    defaultBitrate:
      data.bitrate === undefined
        ? DEFAULT_TEMP_VOICE_CONFIG.defaultBitrate
        : data.bitrate === null
          ? null
          : Math.floor(data.bitrate / 1_000),
    categoryId: data.defaultCategoryId,
    defaultLocked: data.defaultLocked ?? false,
    defaultHidden: data.defaultHidden ?? false,
    deleteDelaySeconds: Math.floor(
      (data.deleteEmptyAfterMs ??
        DEFAULT_TEMP_VOICE_CONFIG.deleteDelaySeconds * 1_000) / 1_000,
    ),
    maxChannelsPerUser:
      data.maxChannelsPerUser ?? DEFAULT_TEMP_VOICE_CONFIG.maxChannelsPerUser,
    logChannelId: data.logChannelId,
    logWebhook: data.logWebhook,
    controlPanelEnabled: data.controlPanelEnabled ?? true,
    allowCustomization: data.allowOwnerManagement ?? true,
    moderationEnabled: data.enableNameModeration ?? false,
    customPatterns: data.blockedKeywords ?? [],
  };
}

export function mapApiInputToUpdateData(
  data: TempVoiceConfigApiInput,
): TempVoiceConfigUpdate {
  return {
    ...(data.enabled !== undefined && { enabled: data.enabled }),
    ...(data.joinChannelIds && { joinToCreateChannels: data.joinChannelIds }),
    ...(data.namingScheme !== undefined && {
      namingScheme: mapNamingSchemeToDb(data.namingScheme),
    }),
    ...(data.customNamingPattern !== undefined && {
      defaultNameTemplate: data.customNamingPattern ?? undefined,
    }),
    ...(data.userLimit !== undefined && {
      defaultUserLimit: data.userLimit ?? 0,
    }),
    ...(data.bitrate !== undefined && {
      defaultBitrate:
        data.bitrate === null ? null : Math.floor(data.bitrate / 1_000),
    }),
    ...(data.defaultCategoryId !== undefined && {
      categoryId: data.defaultCategoryId ?? undefined,
    }),
    ...(data.defaultLocked !== undefined && {
      defaultLocked: data.defaultLocked,
    }),
    ...(data.defaultHidden !== undefined && {
      defaultHidden: data.defaultHidden,
    }),
    ...(data.deleteEmptyAfterMs !== undefined && {
      deleteDelaySeconds: Math.floor(data.deleteEmptyAfterMs / 1000),
    }),
    ...(data.controlPanelEnabled !== undefined && {
      controlPanelEnabled: data.controlPanelEnabled,
    }),
    ...(data.allowOwnerManagement !== undefined && {
      allowCustomization: data.allowOwnerManagement,
    }),
    ...(data.maxChannelsPerUser !== undefined && {
      maxChannelsPerUser: data.maxChannelsPerUser,
    }),
    ...(data.logChannelId !== undefined && {
      logChannelId: data.logChannelId ?? undefined,
    }),
    ...(data.logWebhook !== undefined && {
      logWebhook: data.logWebhook ?? undefined,
    }),
    ...(data.enableNameModeration !== undefined && {
      moderationEnabled: data.enableNameModeration,
    }),
    ...(data.blockedKeywords !== undefined && {
      customPatterns: data.blockedKeywords,
    }),
  };
}
