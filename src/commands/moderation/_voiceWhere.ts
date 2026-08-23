import { ActionRowBuilder, ButtonBuilder, ButtonStyle, channelMention } from 'discord.js';
import type { VoiceWhereOptions } from '#lib/interaction/typedOptions.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { getJson, CacheKey } from '#lib/cache/index.js';
import { VoiceMemberPresenceSchema } from '#root/modules/voice/domain/types.js';
import { EMOJI, container, errorMessage, safeTag } from '#lib/discord/index.js';
import {
  getVoiceIndicators,
  formatMemberName,
} from '#root/modules/voice/services/messageBuilders.js';

export async function handleVoiceWhere(options: VoiceWhereOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const cached = await getJson(
      CacheKey.voiceMemberPresence(options.guildId, options.targetId),
      VoiceMemberPresenceSchema
    );

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
    const inVoice = voiceState.channelId !== null;

    const c = container().h2(`${EMOJI.USER.ICONS.MEMBER} ${formatMemberName(member)}`);

    if (inVoice && voiceState.channel && voiceState.channelId) {
      const indicators = getVoiceIndicators(
        { ...voiceState, channelId: voiceState.channelId },
        member.id
      );
      c.kv({
        Channel: channelMention(voiceState.channelId),
        State: indicators,
      });

      if (voiceState.streaming) {
        c.text(`${EMOJI.VOICE.STATE.SCREENSHARE} **Streaming**`);
      }

      if (cached) {
        const joinedAgo = Math.floor((Date.now() - cached.timestamp) / 1000);
        c.text(`_Tracked for ${formatSeconds(joinedAgo)}_`);
      }
    } else {
      c.text('_Not in a voice channel_');

      if (cached) {
        c.text(`_Last seen <t:${Math.floor(cached.timestamp / 1000)}:R>_`);
      }
    }

    if (inVoice && voiceState.channelId) {
      c.separator();

      // All buttons in one row
      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`voice_join:${voiceState.channelId}`)
          .setEmoji(EMOJI.USER.ACTIONS.CONNECT)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice_mute:${options.targetId}`)
          .setEmoji(EMOJI.VOICE.CONTROLS.TOGGLE_MIC)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`voice_disconnect:${options.targetId}`)
          .setEmoji(EMOJI.USER.ACTIONS.DISCONNECT)
          .setStyle(ButtonStyle.Secondary)
      );

      c.actions(actionRow);
    }

    await ctx.editReply(c);
  } catch (error) {
    ctx.client.logger.error('Error in voice where command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An error occurred while checking voice location.'))
      .catch(() => {});
  }
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
