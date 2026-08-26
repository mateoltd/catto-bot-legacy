import type {
  TempVoiceCommand,
  TempVoiceSignal,
  TempVoiceTransportMessage,
} from "../domain/temp-voice.messages.js";
import type { TempVoiceResult } from "../domain/temp-voice.types.js";

export interface TempVoiceTransport {
  submit(
    command: TempVoiceCommand,
  ): Promise<TempVoiceResult<{ message: string }>>;
  publish(
    signal: TempVoiceSignal,
    options?: TempVoicePublishOptions,
  ): Promise<void>;
  schedule(
    signal: TempVoiceSignal,
    delayMs: number,
    jobId: string,
  ): Promise<void>;
  dispatch(
    message: TempVoiceTransportMessage,
  ): Promise<TempVoiceResult<{ message: string }>>;
  shutdown(): Promise<void>;
}

export interface TempVoicePublishOptions {
  readonly jobId?: string;
  readonly delayMs?: number;
}
