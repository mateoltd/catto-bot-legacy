/**
 * Service for managing control panel messages (Components V2)
 */

import { TempVoiceChannel } from '@prisma/client';
import type { Client, GuildMember, Message, VoiceChannel } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { container as sapphireContainer } from '@sapphire/framework';
import { EMOJI } from '#lib/discord/design/index.js';
import { encodeCustomId } from '#lib/discord/core/index.js';
import { container as fluentContainer } from '#lib/discord/containers/container.js';
import { TempChannelService } from './temp-channel.service.js';

export class ControlPanelService {
  constructor(
    private _client: Client,
    private _channelService: TempChannelService
  ) {}

  /**
   * Send a control panel message to the voice channel's text chat
   */
  async send(channelId: string, owner: GuildMember): Promise<Message | null> {
    try {
      const tempChannel = await this._channelService.getByChannelId(channelId);
      if (!tempChannel) {
        return null;
      }

      const voiceChannel = await this._client.channels.fetch(channelId);
      if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
        return null;
      }

      const guild = owner.guild;
      const botMember = guild.members.me;
      if (!botMember) {
        return null;
      }

      // Voice channels support text messages — send directly
      const voiceChan = voiceChannel as VoiceChannel;
      if (!voiceChan.permissionsFor(botMember)?.has('SendMessages')) {
        sapphireContainer.logger.warn(
          `[TempVoice Panel] Bot lacks SendMessages in voice channel ${channelId}`
        );
        return null;
      }

      const panel = this.buildPanel(tempChannel, voiceChan, owner);
      const buttonRow = this.buildButtons(tempChannel);

      const message = await voiceChan.send({
        components: [panel.actions(buttonRow).build()],
        flags: MessageFlags.IsComponentsV2,
      });

      // Store message info in database
      await this._channelService.update(channelId, {
        controlPanelMessageId: message.id,
        controlPanelChannelId: voiceChan.id,
      });

      return message;
    } catch (error) {
      sapphireContainer.logger.error('[TempVoice Panel] Failed to send:', error);
      return null;
    }
  }

  /**
   * Update an existing control panel message
   */
  async refresh(channelId: string): Promise<void> {
    try {
      const tempChannel = await this._channelService.getByChannelId(channelId);
      if (
        !tempChannel ||
        !tempChannel.controlPanelMessageId ||
        !tempChannel.controlPanelChannelId
      ) {
        return;
      }

      const textChannel = await this._client.channels.fetch(tempChannel.controlPanelChannelId);
      if (!textChannel || !('messages' in textChannel) || !('guild' in textChannel)) {
        return;
      }

      const message = await textChannel.messages.fetch(tempChannel.controlPanelMessageId);
      if (!message) {
        return;
      }

      const voiceChannel = (await this._client.channels.fetch(channelId)) as VoiceChannel;
      if (!voiceChannel) {
        return;
      }

      const owner = await textChannel.guild.members.fetch(tempChannel.ownerId);
      const panel = this.buildPanel(tempChannel, voiceChannel, owner);
      const buttonRow = this.buildButtons(tempChannel);

      await message.edit({
        components: [panel.actions(buttonRow).build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      sapphireContainer.logger.error('[TempVoice Panel] Failed to refresh:', error);
    }
  }

  /**
   * Delete a control panel message
   */
  async delete(messageId: string, textChannelId: string): Promise<void> {
    try {
      const channel = await this._client.channels.fetch(textChannelId);
      if (!channel || !('messages' in channel)) {
        return;
      }

      const message = await channel.messages.fetch(messageId);
      if (message) {
        await message.delete();
      }
    } catch (error) {
      sapphireContainer.logger.error('[TempVoice Panel] Failed to delete:', error);
    }
  }

  /**
   * Build the control panel using Components V2 FluentContainer
   */
  private buildPanel(
    tempChannel: TempVoiceChannel,
    voiceChannel: VoiceChannel,
    owner: GuildMember
  ) {
    const memberCount = voiceChannel.members.size;
    const userLimit = tempChannel.customUserLimit ?? voiceChannel.userLimit;
    const membersDisplay =
      userLimit && userLimit > 0 ? `\`${memberCount}/${userLimit}\`` : `\`${memberCount}\``;

    const bitrate = (tempChannel.customBitrate || voiceChannel.bitrate) / 1000;
    const region = tempChannel.customRegion || voiceChannel.rtcRegion || 'auto';
    const lockStatus = tempChannel.isLocked
      ? `${EMOJI.CHANNELS.STATE.LOCKED} \`locked\``
      : `${EMOJI.CHANNELS.STATE.UNLOCKED} \`unlocked\``;
    const visStatus = tempChannel.isHidden
      ? `${EMOJI.UI.INDICATORS.HIDDEN} \`hidden\``
      : `${EMOJI.UI.INDICATORS.VISIBILITY} \`visible\``;

    return fluentContainer({ color: 0xffffff })
      .h2(`Voice Channel Control Panel`)
      .separator()
      .kv({
        [`${EMOJI.USER.ROLES.OWNER} Owner`]: `<@${owner.id}>`,
        [`${EMOJI.USER.ICONS.MULTIPLE_MEMBERS} Members`]: membersDisplay,
      })
      .separator()
      .text(
        `> ${EMOJI.VOICE.CONTROLS.BITRATE} \`${bitrate}kbps\` • ` +
          `${EMOJI.TIME.LOCATION}\`${region}\`` +
          `\n> ${visStatus} • ` +
          `${lockStatus}`
      )
      .divider()
      .footer(`${EMOJI.USER.ICONS.ID_CARD} Channel ID: ${voiceChannel.id}`);
  }

  /**
   * Build the 3 category buttons (settings, users, ownership)
   */
  private buildButtons(tempChannel: TempVoiceChannel): ActionRowBuilder<ButtonBuilder> {
    const channelId = tempChannel.channelId;

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeCustomId('tv', 'settings', channelId))
        .setEmoji(EMOJI.UI.ACTIONS.SETTINGS)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId('tv', 'users', channelId))
        .setEmoji(EMOJI.USER.ICONS.MULTIPLE_MEMBERS)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId('tv', 'ownership', channelId))
        .setEmoji(EMOJI.USER.ROLES.OWNER)
        .setStyle(ButtonStyle.Secondary)
    );
  }
}
