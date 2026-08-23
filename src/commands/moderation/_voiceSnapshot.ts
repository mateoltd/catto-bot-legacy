import type { GuildMember } from 'discord.js';
import type { VoiceSnapshotOptions } from '#lib/interaction/typedOptions.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { EMOJI, container, errorMessage } from '#lib/discord/index.js';
import { formatVoiceMemberLine } from '#root/modules/voice/services/messageBuilders.js';

export async function handleVoiceSnapshot(options: VoiceSnapshotOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const voiceChannel = options.channel;
    const members = voiceChannel.members;
    const memberCount = members.size;

    const c = container()
      .h2(`${EMOJI.VOICE.ICONS.GENERIC} ${voiceChannel.name}`)
      .kv({
        Members: memberCount.toString(),
        Taken: `<t:${Math.floor(Date.now() / 1000)}:F>`,
      });

    if (memberCount === 0) {
      c.text('_No members in this channel_');
    } else {
      c.separator();

      const memberLines = Array.from(members.values())
        .slice(0, 25)
        .map((member: GuildMember) => formatMemberLine(member));

      const memberList = memberLines.length > 0 ? memberLines.join('\n') : '_No members_';
      c.text(memberList);

      if (memberCount > 25) {
        c.text(`_... and ${memberCount - 25} more members_`);
      }
    }

    c.separator().text(
      `**Channel Info:** User Limit: ${voiceChannel.userLimit || 'None'} | Bitrate: ${Math.floor(voiceChannel.bitrate / 1000)}kbps`
    );

    await ctx.editReply(c);
  } catch (error) {
    ctx.client.logger.error('Error in voice snapshot command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An error occurred while taking the snapshot.'))
      .catch(() => {});
  }
}

// this function is redundant, but it's here for future usage
function formatMemberLine(member: GuildMember): string {
  return formatVoiceMemberLine(member, { useMention: true, channelId: member.voice.channelId });
}
