import type { TempVoiceConfig } from "../models/config.model.js";

export interface TempVoicePreferenceData {
  readonly customName?: string | null;
  readonly customUserLimit?: number | null;
  readonly customBitrate?: number | null;
  readonly customRegion?: string | null;
  readonly preferLocked?: boolean;
  readonly preferHidden?: boolean;
  readonly allowedUserIds?: readonly string[];
  readonly deniedUserIds?: readonly string[];
  readonly trustedUserIds?: readonly string[];
}

export interface TempVoiceConfigProvider {
  get(guildId: string): Promise<TempVoiceConfig>;
  getOrNull(guildId: string): Promise<TempVoiceConfig | null>;
}

export interface TempVoicePreferenceStore {
  get(guildId: string, userId: string): Promise<TempVoicePreferenceData | null>;
  save(
    guildId: string,
    userId: string,
    data: TempVoicePreferenceData,
  ): Promise<void>;
}
