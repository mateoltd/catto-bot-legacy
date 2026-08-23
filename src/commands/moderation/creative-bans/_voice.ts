/**
 * Voice playback utilities for creative ban commands
 *
 * Provides helpers to join a voice channel, play audio files sequentially,
 * and clean up connections. All operations are wrapped in error handling so
 * that a voice failure never prevents the ban from executing.
 */

import { container } from '@sapphire/framework';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  entersState,
  type VoiceConnection,
} from '@discordjs/voice';
import type { VoiceChannel, StageChannel } from 'discord.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time a voice connection should stay alive (safety net). */
const MAX_CONNECTION_DURATION_MS = 60_000;

/** Timeout for waiting on a player to go idle after finishing a track. */
const PLAYER_IDLE_TIMEOUT_MS = 15_000;

/** Timeout for the voice connection to reach the Ready state. */
const CONNECTION_READY_TIMEOUT_MS = 10_000;

/** Base directory for creative-ban audio assets. */
const AUDIO_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../assets/audio/creative-bans'
);

// ---------------------------------------------------------------------------
// Audio file resolution
// ---------------------------------------------------------------------------

export type AudioClip =
  | 'air-raid'
  | 'missile-fly'
  | 'explosion'
  | 'target-locked'
  | 'target-locked-2'
  | 'emergency-meeting'
  | 'ejection'
  | 'discussion';

/**
 * Resolve an audio clip name to its absolute file path.
 * Returns `null` if the file does not exist on disk.
 */
export function resolveAudioPath(clip: AudioClip): string | null {
  const filePath = resolve(AUDIO_DIR, `${clip}.ogg`);
  return existsSync(filePath) ? filePath : null;
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/**
 * Join a voice channel and return the connection once it is ready.
 * Returns `null` if the connection cannot be established within the timeout.
 */
export interface JoinVoiceOptions {
  /** Optional connection group to isolate concurrent sessions in the same guild. */
  group?: string;
}

export async function joinVoice(
  voiceChannel: VoiceChannel | StageChannel,
  options: JoinVoiceOptions = {}
): Promise<VoiceConnection | null> {
  const { group } = options;

  try {
    container.logger.info(
      `[creative-bans/voice] Joining ${voiceChannel.name} (${voiceChannel.id})${group ? ` group=${group}` : ''}`
    );
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      debug: true,
      group,
    });

    connection.on('debug', (msg) => container.logger.debug(`[creative-bans/voice] ${msg}`));
    connection.on('error', (err) =>
      container.logger.error('[creative-bans/voice] Connection error:', err)
    );
    connection.on('stateChange', (_old, cur) =>
      container.logger.info(`[creative-bans/voice] Connection state: ${cur.status}`)
    );

    // Wait until the connection is ready
    await entersState(connection, VoiceConnectionStatus.Ready, CONNECTION_READY_TIMEOUT_MS);
    container.logger.info('[creative-bans/voice] Connection ready');
    return connection;
  } catch (error) {
    container.logger.error('[creative-bans/voice] Failed to join voice channel:', error);
    return null;
  }
}

/**
 * Destroy a voice connection safely.
 */
export function disconnectVoice(connection: VoiceConnection | null): void {
  if (!connection) return;
  try {
    connection.destroy();
  } catch {
    // Already destroyed or in an unusable state
  }
}

// ---------------------------------------------------------------------------
// Playback helpers
// ---------------------------------------------------------------------------

/**
 * Play a single audio clip through an existing voice connection.
 * Resolves when the clip finishes or the timeout is reached.
 * Returns `true` if playback completed, `false` otherwise.
 */
export async function playClip(connection: VoiceConnection, clip: AudioClip): Promise<boolean> {
  const filePath = resolveAudioPath(clip);
  if (!filePath) {
    container.logger.error(
      `[creative-bans/voice] Audio file missing: ${clip} (AUDIO_DIR=${AUDIO_DIR})`
    );
    return false;
  }

  container.logger.info(`[creative-bans/voice] Playing clip: ${clip} (${filePath})`);
  const player = createAudioPlayer();

  player.on('error', (err) =>
    container.logger.error(`[creative-bans/voice] Player error on ${clip}:`, err)
  );
  player.on('stateChange', (_old, cur) =>
    container.logger.debug(`[creative-bans/voice] Player ${clip}: ${cur.status}`)
  );

  const resource = createAudioResource(createReadStream(filePath), {
    inputType: StreamType.OggOpus,
  });

  connection.subscribe(player);
  player.play(resource);

  try {
    await entersState(player, AudioPlayerStatus.Idle, PLAYER_IDLE_TIMEOUT_MS);
    container.logger.info(`[creative-bans/voice] Clip finished: ${clip}`);
    return true;
  } catch {
    container.logger.error(
      `[creative-bans/voice] Playback timed out for: ${clip} (state=${player.state.status})`
    );
    player.stop(true);
    return false;
  }
}

/**
 * Start playing a clip without awaiting completion.
 * Returns a stop function to end playback early (e.g. for background music during voting).
 * Returns `null` if the clip couldn't be started.
 */
export function startClip(connection: VoiceConnection, clip: AudioClip): (() => void) | null {
  const filePath = resolveAudioPath(clip);
  if (!filePath) {
    container.logger.error(
      `[creative-bans/voice] Audio file missing: ${clip} (AUDIO_DIR=${AUDIO_DIR})`
    );
    return null;
  }

  container.logger.info(`[creative-bans/voice] Starting background clip: ${clip}`);
  const player = createAudioPlayer();

  player.on('error', (err) =>
    container.logger.error(`[creative-bans/voice] Player error on ${clip}:`, err)
  );

  const resource = createAudioResource(createReadStream(filePath), {
    inputType: StreamType.OggOpus,
  });

  connection.subscribe(player);
  player.play(resource);

  return () => {
    player.stop(true);
    container.logger.info(`[creative-bans/voice] Stopped background clip: ${clip}`);
  };
}

/**
 * Step definition for a playback sequence.
 */
export interface PlaybackStep {
  /** Audio clip to play. */
  clip: AudioClip;
  /** Optional delay (ms) to wait *after* the clip finishes before the next step. */
  postDelay?: number;
}

/**
 * Play a sequence of audio clips through a voice connection.
 * Continues to the next step even if one fails. Returns `true` if *all* clips
 * played successfully, `false` if any were skipped or failed.
 */
export async function playSequence(
  connection: VoiceConnection,
  steps: PlaybackStep[]
): Promise<boolean> {
  let allOk = true;

  for (const step of steps) {
    const ok = await playClip(connection, step.clip);
    if (!ok) allOk = false;

    if (step.postDelay && step.postDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, step.postDelay));
    }
  }

  return allOk;
}

// ---------------------------------------------------------------------------
// High-level session wrapper
// ---------------------------------------------------------------------------

/**
 * Options for `withVoiceSession`.
 */
export interface VoiceSessionOptions {
  /** The voice channel to join. */
  voiceChannel: VoiceChannel | StageChannel;
  /** Maximum duration (ms) for the entire session. Defaults to MAX_CONNECTION_DURATION_MS. */
  maxDuration?: number;
}

/**
 * Open a voice session, run a callback with the connection and player utilities,
 * and guarantee cleanup afterwards. If the connection cannot be established the
 * callback is never invoked — the caller should handle the `null` return
 * gracefully (i.e. fall back to text-only).
 *
 * @returns Whatever the callback returns, or `null` if the session could not start.
 */
export async function withVoiceSession<T>(
  options: VoiceSessionOptions,
  callback: (connection: VoiceConnection) => Promise<T>
): Promise<T | null> {
  const { voiceChannel, maxDuration = MAX_CONNECTION_DURATION_MS } = options;

  const connection = await joinVoice(voiceChannel);
  if (!connection) return null;

  // Safety timeout — hard disconnect after maxDuration
  const safetyTimer = setTimeout(() => {
    container.logger.warn('[creative-bans/voice] Safety timeout reached, disconnecting');
    disconnectVoice(connection);
  }, maxDuration);

  try {
    return await callback(connection);
  } catch (error) {
    container.logger.error('[creative-bans/voice] Error during voice session:', error);
    return null;
  } finally {
    clearTimeout(safetyTimer);
    disconnectVoice(connection);
  }
}
