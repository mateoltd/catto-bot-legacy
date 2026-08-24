import { TempVoiceNamingScheme } from '@prisma/client';
import { OwnerLeaveStrategy } from '../constants.js';
import type {
  TempVoiceConfig,
  TempVoiceConfigInput,
  TempVoiceConfigUpdate,
} from '../models/config.model.js';

export interface TempVoiceConfigApiInput {
  enabled?: boolean;
  joinChannelIds?: string[];
  namingScheme?: 'username' | 'custom' | 'displayname' | 'sequential';
  customNamingPattern?: string | null;
  userLimit?: number | null;
  bitrate?: number | null;
  defaultCategoryId?: string | null;
  defaultLocked?: boolean;
  defaultHidden?: boolean;
  deleteEmptyAfterMs?: number;
  ownerLeaveStrategy?: OwnerLeaveStrategy;
  allowOwnerManagement?: boolean;
  maxChannelsPerUser?: number;
  logChannelId?: string | null;
  logWebhook?: string | null;
  enableNameModeration?: boolean;
  blockedKeywords?: string[];
}

function mapNamingSchemeToDb(
  scheme: NonNullable<TempVoiceConfigApiInput['namingScheme']>,
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
): NonNullable<TempVoiceConfigApiInput['namingScheme']> {
  return {
    [TempVoiceNamingScheme.USERNAME]: 'username' as const,
    [TempVoiceNamingScheme.DISPLAYNAME]: 'displayname' as const,
    [TempVoiceNamingScheme.SEQUENTIAL]: 'sequential' as const,
    [TempVoiceNamingScheme.CUSTOM]: 'custom' as const,
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
    bitrate: config.defaultBitrate,
    defaultCategoryId: config.categoryId,
    defaultLocked: config.defaultLocked,
    defaultHidden: config.defaultHidden,
    autoDeleteEmpty: true,
    deleteEmptyAfterMs: config.deleteDelaySeconds * 1000,
    ownerLeaveStrategy: config.ownerLeaveStrategy,
    allowOwnerTransfer: config.ownerLeaveStrategy === OwnerLeaveStrategy.TRANSFER,
    allowOwnerManagement: config.controlPanelEnabled,
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
    defaultBitrate: data.bitrate ?? null,
    categoryId: data.defaultCategoryId,
    defaultLocked: data.defaultLocked ?? false,
    defaultHidden: data.defaultHidden ?? false,
    deleteDelaySeconds: Math.floor((data.deleteEmptyAfterMs ?? 60000) / 1000),
    ownerLeaveStrategy: data.ownerLeaveStrategy ?? OwnerLeaveStrategy.TRANSFER,
    maxChannelsPerUser: data.maxChannelsPerUser ?? 1,
    logChannelId: data.logChannelId,
    logWebhook: data.logWebhook,
    controlPanelEnabled: data.allowOwnerManagement ?? true,
    moderationEnabled: data.enableNameModeration ?? false,
    customPatterns: data.blockedKeywords ?? [],
  };
}

export function mapApiInputToUpdateData(data: TempVoiceConfigApiInput): TempVoiceConfigUpdate {
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
    ...(data.bitrate !== undefined && { defaultBitrate: data.bitrate }),
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
    ...(data.ownerLeaveStrategy !== undefined && {
      ownerLeaveStrategy: data.ownerLeaveStrategy,
    }),
    ...(data.allowOwnerManagement !== undefined && {
      controlPanelEnabled: data.allowOwnerManagement,
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
