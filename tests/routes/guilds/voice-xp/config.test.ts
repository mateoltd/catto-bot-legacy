import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceXPConfigRoute } from "#routes/guilds/voice-xp/config.js";
import {
  createMockContainer,
  createMockRequest,
  createMockResponse,
  expectSuccess,
} from "../../../helpers/test-helpers.js";

vi.mock("#root/modules/xp/xp-voice/index.js", () => ({
  getVoiceXPConfig: vi.fn(),
  updateVoiceXPConfig: vi.fn(),
}));

vi.mock("#lib/route-utils.js", () => ({
  parseRequestBody: vi.fn((request) => Promise.resolve(request.body)),
}));

import { updateVoiceXPConfig } from "#root/modules/xp/xp-voice/index.js";

describe("VoiceXPConfigRoute", () => {
  let route: VoiceXPConfigRoute;

  beforeEach(() => {
    const mockContainer = createMockContainer();
    route = Object.create(VoiceXPConfigRoute.prototype);
    Object.defineProperty(route, "container", {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it.each(["PER_MINUTE", "PER_SESSION"] as const)(
    "persists the %s credit timing mode",
    async (xpMode) => {
      vi.mocked(updateVoiceXPConfig).mockResolvedValue({
        guildId: "123456789012345678",
        xpMode,
      } as never);
      const request = createMockRequest({
        method: "PUT",
        params: { guildId: "123456789012345678" },
        body: { xpMode },
      });
      const response = createMockResponse();

      await route.run(request, response as never);

      expectSuccess(response);
      expect(updateVoiceXPConfig).toHaveBeenCalledWith(
        "123456789012345678",
        expect.objectContaining({ xpMode }),
      );
    },
  );
});
