import type { VoiceChannel } from "discord.js";

import type { TempVoiceRecord } from "../domain/temp-voice.types.js";

export interface TempVoiceProjectionOptions {
  readonly controlPanelEnabled: boolean;
  readonly forceMessageFetch?: boolean;
}

export interface TempVoiceProjection {
  reconcile(
    record: TempVoiceRecord,
    channel: VoiceChannel,
    options: TempVoiceProjectionOptions,
  ): Promise<void>;
}
