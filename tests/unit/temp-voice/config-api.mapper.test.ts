import { describe, expect, it } from 'vitest';
import { TempVoiceNamingScheme } from '@prisma/client';
import { OwnerLeaveStrategy } from '#modules/temp-voice/constants.js';
import type { TempVoiceConfig } from '#modules/temp-voice/models/config.model.js';
import {
  mapApiInputToCreateData,
  mapApiInputToUpdateData,
  mapConfigToApiResponse,
} from '#modules/temp-voice/services/config-api.mapper.js';

describe('Temp Voice dashboard config mapping', () => {
  it('maps editable dashboard fields to persisted model fields', () => {
    expect(
      mapApiInputToUpdateData({
        userLimit: null,
        bitrate: null,
        defaultLocked: true,
        defaultHidden: true,
        ownerLeaveStrategy: OwnerLeaveStrategy.DELETE,
        deleteEmptyAfterMs: 30_000,
        allowOwnerManagement: false,
        enableNameModeration: true,
        blockedKeywords: ['spam', 'scam'],
      }),
    ).toMatchObject({
      defaultUserLimit: 0,
      defaultBitrate: null,
      defaultLocked: true,
      defaultHidden: true,
      ownerLeaveStrategy: OwnerLeaveStrategy.DELETE,
      deleteDelaySeconds: 30,
      controlPanelEnabled: false,
      moderationEnabled: true,
      customPatterns: ['spam', 'scam'],
    });
  });

  it('maps create payloads with the same dashboard contract', () => {
    expect(
      mapApiInputToCreateData({
        defaultLocked: true,
        defaultHidden: true,
        ownerLeaveStrategy: OwnerLeaveStrategy.KEEP,
        enableNameModeration: true,
        blockedKeywords: ['blocked'],
      }),
    ).toMatchObject({
      defaultLocked: true,
      defaultHidden: true,
      ownerLeaveStrategy: OwnerLeaveStrategy.KEEP,
      moderationEnabled: true,
      customPatterns: ['blocked'],
    });
  });

  it('returns persisted fields in the dashboard response', () => {
    const now = new Date();
    const config = {
      guildId: '123456789012345678',
      enabled: true,
      joinToCreateChannels: [],
      namingScheme: TempVoiceNamingScheme.USERNAME,
      defaultNameTemplate: "{username}'s Channel",
      defaultUserLimit: 0,
      defaultBitrate: null,
      categoryId: null,
      defaultLocked: true,
      defaultHidden: true,
      deleteDelaySeconds: 30,
      ownerLeaveStrategy: OwnerLeaveStrategy.DELETE,
      controlPanelEnabled: false,
      maxChannelsPerUser: 3,
      logChannelId: null,
      logWebhook: null,
      moderationEnabled: true,
      customPatterns: ['spam'],
      createdAt: now,
      updatedAt: now,
    } as TempVoiceConfig;

    expect(mapConfigToApiResponse(config)).toMatchObject({
      defaultLocked: true,
      defaultHidden: true,
      ownerLeaveStrategy: OwnerLeaveStrategy.DELETE,
      allowOwnerManagement: false,
      enableNameModeration: true,
      blockedKeywords: ['spam'],
      bitrate: null,
    });
  });
});
