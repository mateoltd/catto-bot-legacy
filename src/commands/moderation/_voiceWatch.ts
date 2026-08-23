import { container as sapphireContainer } from '@sapphire/framework';
import type { VoiceWatchOptions } from '#lib/interaction/typedOptions.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { setJson, CacheKey } from '#lib/cache/index.js';
import {
  VoiceWatchSessionSchema,
  VOICE_WATCH_CONFIG,
  VOICE_CACHE_TTL,
  type VoiceWatchSession,
} from '#root/modules/voice/domain/types.js';
import { container, errorMessage, safeTag } from '#lib/discord/index.js';
import { registerSession } from '#root/modules/voice/services/voiceUpdate.js';
import {
  formatMemberName,
  buildWatchMessageFromParams,
} from '#root/modules/voice/services/messageBuilders.js';

export async function handleVoiceWatch(options: VoiceWatchOptions, ctx: CommandResponder) {
  if (options.durationSeconds < VOICE_WATCH_CONFIG.minDurationSeconds) {
    await ctx.replyError(
      `Minimum watch duration is ${VOICE_WATCH_CONFIG.minDurationSeconds / 60} minute(s).`
    );
    return;
  }

  if (options.durationSeconds > VOICE_WATCH_CONFIG.maxDurationSeconds) {
    await ctx.replyError(
      `Maximum watch duration is ${VOICE_WATCH_CONFIG.maxDurationSeconds / 60} minutes.`
    );
    return;
  }

  await ctx.deferPublic();

  try {
    let member;
    try {
      member = await options.guild.members.fetch(options.targetId);
    } catch {
      await ctx.editReply(
        container().text(`User **${safeTag(options.target.tag)}** is not a member of this server.`)
      );
      return;
    }

    const voiceState = member.voice;
    const now = Date.now();
    const endsAt = now + options.durationSeconds * 1000;

    const c = buildWatchMessageFromParams({
      targetId: options.targetId,
      displayName: formatMemberName(member),
      voiceState: {
        channelId: voiceState.channelId,
        channel: voiceState.channel,
        selfMute: voiceState.selfMute,
        selfDeaf: voiceState.selfDeaf,
        serverMute: voiceState.serverMute,
        serverDeaf: voiceState.serverDeaf,
        streaming: voiceState.streaming,
        selfVideo: voiceState.selfVideo,
      },
      endsAt,
      updateCount: 0,
    });

    const reply = await ctx.editReply(c);

    // Use the reply message ID as the unique session key
    const sessionKey = reply.id;

    const session: VoiceWatchSession = {
      targetId: options.targetId,
      channelId: voiceState.channelId,
      startedAt: now,
      endsAt,
      lastUpdateAt: now,
      messageId: reply.id,
      channelIdMessage: reply.channelId,
      updateCount: 0,
    };

    await setJson(
      CacheKey.voiceWatch(options.guildId, sessionKey),
      VoiceWatchSessionSchema,
      session,
      VOICE_CACHE_TTL.watchSession
    );

    await sapphireContainer.redis.sadd(
      CacheKey.voiceWatchByTarget(options.guildId, options.targetId),
      sessionKey
    );
    await sapphireContainer.redis.expire(
      CacheKey.voiceWatchByTarget(options.guildId, options.targetId),
      VOICE_CACHE_TTL.watchSession
    );

    registerSession('watch', options.guildId, sessionKey);
  } catch (error) {
    ctx.client.logger.error('Error in voice watch command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An error occurred while starting the watch.'))
      .catch(() => {});
  }
}
