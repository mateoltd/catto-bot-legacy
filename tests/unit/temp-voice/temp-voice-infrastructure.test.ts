import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { describe, expect, it } from "vitest";

import {
  normalizeConfigBitrateKbps,
  normalizeDiscordBitrateBps,
} from "#modules/temp-voice/domain/temp-voice-bitrate.js";
import { classifyDiscordError } from "#modules/temp-voice/infrastructure/discord-error-classifier.js";

const discordError = (code: number, message: string) =>
  new DiscordAPIError(
    { code, message },
    code,
    403,
    "POST",
    "https://discord.test/channels",
    { body: null, files: [] },
  );

describe("temp voice infrastructure normalization", () => {
  it("normalizes legacy and double-scaled bitrate values at persistence boundaries", () => {
    expect(normalizeConfigBitrateKbps(64_000)).toBe(64);
    expect(normalizeConfigBitrateKbps(64)).toBe(64);
    expect(normalizeDiscordBitrateBps(64)).toBe(64_000);
    expect(normalizeDiscordBitrateBps(64_000)).toBe(64_000);
    expect(normalizeDiscordBitrateBps(64_000_000)).toBe(64_000);
  });

  it("classifies undeliverable DMs as terminal for the current render", () => {
    for (const code of [
      RESTJSONErrorCodes.CannotSendMessagesToThisUser,
      50_278,
    ]) {
      const classified = classifyDiscordError(
        discordError(code, "Cannot send messages to this user"),
      );
      expect(classified.isPermanentDeliveryFailure).toBe(true);
      expect(classified.retryable).toBe(false);
    }
  });
});
