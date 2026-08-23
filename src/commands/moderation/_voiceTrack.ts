import { container as sapphireContainer } from '@sapphire/framework';
import type { VoiceTrackOptions } from '#lib/interaction/typedOptions.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { setJson, CacheKey } from '#lib/cache/index.js';
import {
  VoiceTrackSessionSchema,
  VOICE_WATCH_CONFIG,
  VOICE_CACHE_TTL,
  type VoiceTrackSession,
} from '#root/modules/voice/domain/types.js';
import { errorMessage } from '#lib/discord/index.js';
import { registerSession } from '#root/modules/voice/services/voiceUpdate.js';
import { buildTrackMessageFromParams } from '#root/modules/voice/services/messageBuilders.js';

export async function handleVoiceTrack(options: VoiceTrackOptions, ctx: CommandResponder) {
  if (options.durationSeconds < VOICE_WATCH_CONFIG.minDurationSeconds) {
    await ctx.replyError(
      `Minimum track duration is ${VOICE_WATCH_CONFIG.minDurationSeconds / 60} minute(s).`
    );
    return;
  }

  if (options.durationSeconds > VOICE_WATCH_CONFIG.maxDurationSeconds) {
    await ctx.replyError(
      `Maximum track duration is ${VOICE_WATCH_CONFIG.maxDurationSeconds / 60} minutes.`
    );
    return;
  }

  await ctx.deferPublic();

  try {
    const voiceChannel = options.channel;
    const now = Date.now();
    const endsAt = now + options.durationSeconds * 1000;

    const c = buildTrackMessageFromParams({
      channelId: options.channelId,
      channelName: voiceChannel.name,
      members: voiceChannel.members,
      endsAt,
      updateCount: 0,
    });

    const reply = await ctx.editReply(c);

    // Use the reply message ID as the unique session key
    const sessionKey = reply.id;

    const session: VoiceTrackSession = {
      channelId: options.channelId,
      startedAt: now,
      endsAt,
      lastUpdateAt: now,
      messageId: reply.id,
      channelIdMessage: reply.channelId,
      updateCount: 0,
    };

    await setJson(
      CacheKey.voiceTrack(options.guildId, sessionKey),
      VoiceTrackSessionSchema,
      session,
      VOICE_CACHE_TTL.trackSession
    );

    await sapphireContainer.redis.sadd(
      CacheKey.voiceTrackByChannel(options.guildId, options.channelId),
      sessionKey
    );
    await sapphireContainer.redis.expire(
      CacheKey.voiceTrackByChannel(options.guildId, options.channelId),
      VOICE_CACHE_TTL.trackSession
    );

    registerSession('track', options.guildId, sessionKey);
  } catch (error) {
    ctx.client.logger.error('Error in voice track command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An error occurred while starting the track.'))
      .catch(() => {});
  }
}
