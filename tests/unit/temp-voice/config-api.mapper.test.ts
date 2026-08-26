import { describe, expect, it } from "vitest";
import { TempVoiceNamingScheme } from "@prisma/client";

import type { TempVoiceConfig } from "#modules/temp-voice/models/config.model.js";
import {
  mapApiInputToCreateData,
  mapApiInputToUpdateData,
  mapConfigToApiResponse,
} from "#modules/temp-voice/services/config-api.mapper.js";

describe("Temp Voice dashboard config mapping", () => {
  it("maps API units and independent management flags to persisted fields", () => {
    expect(
      mapApiInputToUpdateData({
        userLimit: null,
        bitrate: 128_000,
        defaultLocked: true,
        defaultHidden: true,
        deleteEmptyAfterMs: 30_000,
        controlPanelEnabled: false,
        allowOwnerManagement: false,
        enableNameModeration: true,
        blockedKeywords: ["spam", "scam"],
      }),
    ).toMatchObject({
      defaultUserLimit: 0,
      defaultBitrate: 128,
      defaultLocked: true,
      defaultHidden: true,
      deleteDelaySeconds: 30,
      controlPanelEnabled: false,
      allowCustomization: false,
      moderationEnabled: true,
      customPatterns: ["spam", "scam"],
    });
  });

  it("maps create payloads with the same API contract", () => {
    expect(
      mapApiInputToCreateData({
        bitrate: 96_000,
        controlPanelEnabled: false,
        allowOwnerManagement: true,
        enableNameModeration: true,
        blockedKeywords: ["blocked"],
      }),
    ).toMatchObject({
      defaultBitrate: 96,
      controlPanelEnabled: false,
      allowCustomization: true,
      moderationEnabled: true,
      customPatterns: ["blocked"],
    });
  });

  it("uses the canonical persisted defaults for omitted create settings", () => {
    expect(mapApiInputToCreateData({})).toMatchObject({
      defaultBitrate: 64,
      deleteDelaySeconds: 300,
      maxChannelsPerUser: 3,
    });
  });

  it("returns fixed ownership policy and Discord bitrate units", () => {
    const now = new Date();
    const config = {
      guildId: "123456789012345678",
      enabled: true,
      joinToCreateChannels: [],
      namingScheme: TempVoiceNamingScheme.USERNAME,
      defaultNameTemplate: "{username}'s Channel",
      defaultUserLimit: 0,
      defaultBitrate: 128,
      categoryId: null,
      defaultLocked: true,
      defaultHidden: true,
      deleteDelaySeconds: 30,
      controlPanelEnabled: false,
      allowCustomization: true,
      maxChannelsPerUser: 3,
      logChannelId: null,
      logWebhook: null,
      moderationEnabled: true,
      customPatterns: ["spam"],
      createdAt: now,
      updatedAt: now,
    } as TempVoiceConfig;

    expect(mapConfigToApiResponse(config)).toMatchObject({
      controlPanelEnabled: false,
      allowOwnerManagement: true,
      ownershipGraceSeconds: 300,
      allowOwnerTransfer: true,
      enableNameModeration: true,
      blockedKeywords: ["spam"],
      bitrate: 128_000,
    });
  });
});
