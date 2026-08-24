import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VoiceXPConfigForm from "@/components/voice-xp-config-form";
import { voiceXPService } from "@/lib/services/voice-xp.service";
import messages from "@/messages/en-US.json";

vi.mock("@/hooks/use-guild-data", () => ({
  useGuildData: () => ({
    voiceChannels: [],
    textChannels: [],
    roles: [],
    loading: false,
  }),
}));

vi.mock("@/lib/services/voice-xp.service", () => ({
  voiceXPService: {
    updateConfig: vi.fn(),
  },
}));

vi.mock("@/components/xp/level-curve-settings", () => ({
  LevelCurveSettings: () => null,
}));

const initialConfig = {
  enabled: true,
  xpPerMinute: 5,
  minSessionMinutes: 1,
  xpMode: "PER_MINUTE" as const,
  allowedChannels: [],
  ignoredChannels: [],
  awardMuted: false,
  awardDeafened: false,
  awardStreaming: true,
  awardVideo: true,
  ignoreAfkChannel: true,
  antiFarmDampeningEnabled: false,
  antiFarmDampeningMultiplier: 0.5,
  antiFarmMinimumParticipants: 2,
  ignoredRoles: [],
  announceLevelUp: false,
  announceChannelId: null,
  messageTemplate: "{user} reached level {level}",
  embedEnabled: false,
  embedColor: 5814783,
  levelCurveType: "FORMULA" as const,
  formulaBase: 5,
  formulaExponent: 2,
  formulaOffset: 50,
  tableThresholds: [],
};

describe("Voice XP configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(voiceXPService.updateConfig).mockResolvedValue(initialConfig);
  });

  it("saves the selected credit timing mode", async () => {
    render(
      <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
        <SWRConfig value={{ provider: () => new Map() }}>
          <VoiceXPConfigForm
            guildId="123456789012345678"
            initialConfig={initialConfig}
          />
        </SWRConfig>
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: /On exit/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(voiceXPService.updateConfig).toHaveBeenCalledWith(
        "123456789012345678",
        expect.objectContaining({ xpMode: "PER_SESSION" }),
      ),
    );
  });
});
