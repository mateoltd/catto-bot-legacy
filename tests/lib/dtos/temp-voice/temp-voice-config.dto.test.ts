import { describe, it, expect } from "vitest";
import { validateDto } from "#lib/validation/validate-dto.js";
import {
  CreateTempVoiceConfigDto,
  UpdateTempVoiceConfigDto,
  AddJoinChannelDto,
  NamingScheme,
} from "#lib/dtos/temp-voice/temp-voice-config.dto.js";

describe("CreateTempVoiceConfigDto", () => {
  describe("basic validation", () => {
    it("accepts valid configuration", async () => {
      const validConfig = {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        namingScheme: NamingScheme.USERNAME,
        bitrate: 64000,
        userLimit: 10,
      };

      const result = await validateDto(CreateTempVoiceConfigDto, validConfig);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(validConfig);
    });

    it("requires joinChannelIds", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        namingScheme: NamingScheme.USERNAME,
        bitrate: 64000,
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === "joinChannelIds")).toBe(
        true,
      );
    });

    it("rejects empty joinChannelIds", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: [],
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === "joinChannelIds")).toBe(
        true,
      );
    });
  });

  describe("joinChannelIds validation", () => {
    it("accepts valid Discord ID", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid Discord ID", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["invalid"],
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
    });

    it("rejects short IDs", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123"],
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bitrate validation", () => {
    it("accepts valid bitrate", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        bitrate: 96000,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(true);
    });

    it("rejects bitrate below 8000", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        bitrate: 7999,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
    });

    it("rejects bitrate above 384000", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        bitrate: 384001,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
    });

    it("has default value", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(true);
      expect(result.data?.bitrate).toBe(64_000);
      expect(result.data?.deleteEmptyAfterMs).toBe(300_000);
      expect(result.data?.maxChannelsPerUser).toBe(3);
    });
  });

  describe("userLimit validation", () => {
    it("accepts valid user limit", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        userLimit: 10,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(true);
    });

    it("accepts 0 (unlimited)", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        userLimit: 0,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative values", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        userLimit: -1,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
    });

    it("rejects values over 99", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        userLimit: 100,
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("namingScheme validation", () => {
    it("accepts USERNAME", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        namingScheme: NamingScheme.USERNAME,
      });
      expect(result.success).toBe(true);
    });

    it("accepts CUSTOM", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        namingScheme: NamingScheme.CUSTOM,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid scheme", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        namingScheme: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("customNamingPattern validation", () => {
    it("accepts valid pattern", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        customNamingPattern: "{username}'s Channel",
        namingScheme: NamingScheme.CUSTOM,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty string", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        customNamingPattern: "",
        namingScheme: NamingScheme.CUSTOM,
      });
      expect(result.success).toBe(false);
    });

    it("rejects too long pattern", async () => {
      const result = await validateDto(CreateTempVoiceConfigDto, {
        enabled: true,
        joinChannelIds: ["123456789012345678"],
        customNamingPattern: "a".repeat(101),
        namingScheme: NamingScheme.CUSTOM,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("UpdateTempVoiceConfigDto", () => {
  it("accepts partial updates", async () => {
    const result = await validateDto(UpdateTempVoiceConfigDto, {
      bitrate: 128000,
    });
    expect(result.success).toBe(true);
    expect(result.data?.bitrate).toBe(128000);
  });

  it("accepts empty object", async () => {
    const result = await validateDto(UpdateTempVoiceConfigDto, {});
    expect(result.success).toBe(true);
  });

  it("preserves every supported dashboard setting", async () => {
    const dashboardSettings = {
      defaultLocked: true,
      defaultHidden: true,
      controlPanelEnabled: false,
      allowOwnerManagement: false,
      enableNameModeration: true,
      blockedKeywords: ["spam", "scam"],
    };

    const result = await validateDto(
      UpdateTempVoiceConfigDto,
      dashboardSettings,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject(dashboardSettings);
  });

  it("validates provided fields", async () => {
    const result = await validateDto(UpdateTempVoiceConfigDto, {
      userLimit: 150, // Invalid
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple field updates", async () => {
    const result = await validateDto(UpdateTempVoiceConfigDto, {
      bitrate: 96000,
      userLimit: 10,
      defaultName: "Updated Name",
    });
    expect(result.success).toBe(true);
  });
});

describe("AddJoinChannelDto", () => {
  it("accepts valid channel ID", async () => {
    const result = await validateDto(AddJoinChannelDto, {
      channelId: "123456789012345678",
    });
    expect(result.success).toBe(true);
    expect(result.data?.channelId).toBe("123456789012345678");
  });

  it("requires channelId", async () => {
    const result = await validateDto(AddJoinChannelDto, {});
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "channelId")).toBe(true);
  });

  it("rejects invalid Discord ID", async () => {
    const result = await validateDto(AddJoinChannelDto, {
      channelId: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string values", async () => {
    const result = await validateDto(AddJoinChannelDto, {
      channelId: 123456789,
    });
    expect(result.success).toBe(false);
  });
});
