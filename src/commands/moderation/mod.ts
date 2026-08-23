import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import {
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  InteractionContextType,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import type { Message } from 'discord.js';
import { handleKick } from './_kick.js';
import { handleTimeout } from './_timeout.js';
import { handleWarn } from './_warn.js';
import { handleUnban } from './_unban.js';
import { handleCase } from './_case.js';
import { handleCaseVoid } from './_void.js';
import { handleHistory } from './_history.js';
import { handleBan } from './_ban.js';
import { handleVoiceWhere } from './_voiceWhere.js';
import { handleVoiceWatch } from './_voiceWatch.js';
import { handleVoiceSnapshot } from './_voiceSnapshot.js';
import { handleVoiceTrack } from './_voiceTrack.js';
import { handleSoftban } from './_softban.js';
import { handleTempban } from './_tempban.js';
import { handlePanel } from './_panel.js';
import { handleContext } from './_context.js';
import { handleNoteAdd, handleNoteList, handleNoteDelete } from './_note.js';
import { handleEvidenceAdd } from './_evidenceAdd.js';
import { handleEvidenceList } from './_evidenceList.js';

import {
  handleMuteText,
  handleMuteVoice,
  handleMuteBoth,
  handleUnmuteText,
  handleUnmuteVoice,
  handleUnmuteBoth,
  handleMutesList,
} from './_mute.js';
import { handleSetup } from './_setup.js';

import { COLORS } from '#lib/constants.js';
import { InteractionResponder, MessageResponder } from '#lib/discord/index.js';
import { ValidationError } from '#lib/validation/zod.js';
import { ephemeralError, buildErrorText } from '#lib/discord/index.js';
import { UserError, type Args } from '@sapphire/framework';
import {
  parseBanOptions,
  parseKickOptions,
  parseTimeoutOptions,
  parseWarnOptions,
  parseUnbanOptions,
  parseCaseOptions,
  parseVoidOptions,
  parseHistoryOptions,
  parseSoftbanOptions,
  parseTempbanOptions,
  parseVoiceWhereOptions,
  parseVoiceWatchOptions,
  parseVoiceSnapshotOptions,
  parseVoiceTrackOptions,
  parseMuteOptions,
  parseUnmuteOptions,
  parseDurationToSeconds,
} from '#lib/interaction/typedOptions.js';
import { asGuildId } from '../../modules/moderation/domain/types.js';
import {
  parseBanFromMessage,
  parseKickFromMessage,
  parseTimeoutFromMessage,
  parseWarnFromMessage,
  parseUnbanFromMessage,
  parseSoftbanFromMessage,
  parseTempbanFromMessage,
  parseCaseFromMessage,
  parseVoidFromMessage,
  parseHistoryFromMessage,
  parsePanelFromMessage,
  parseContextFromMessage,
  parseMuteFromMessage,
  parseUnmuteFromMessage,
  parseMutesListFromMessage,
  parseSetupFromMessage,
  parseVoiceWhereFromMessage,
  parseVoiceWatchFromMessage,
  parseVoiceSnapshotFromMessage,
  parseVoiceTrackFromMessage,
  parseNoteAddFromMessage,
  parseNoteListFromMessage,
  parseNoteDeleteFromMessage,
  parseEvidenceAddFromMessage,
  parseEvidenceListFromMessage,
} from '#lib/interaction/messageArgs.js';

import type { PanelOptions } from './_panel.js';
import type { ContextOptions } from './_context.js';
import type { NoteAddOptions, NoteListOptions, NoteDeleteOptions } from './_note.js';
import type { EvidenceAddOptions } from './_evidenceAdd.js';
import type { EvidenceListOptions } from './_evidenceList.js';
import type { MutesListOptions } from './_mute.js';
import type { SetupOptions } from './_setup.js';
import { sendModWelcome } from './aliases/_shared.js';

@ApplyOptions<Subcommand.Options>({
  name: 'mod',
  description: 'Moderation commands',
  requiredClientPermissions: [PermissionFlagsBits.ModerateMembers],
  subcommands: [
    { name: 'help', default: true, messageRun: 'messageModHelp' },
    { name: 'ban', chatInputRun: 'chatInputBan', messageRun: 'messageBan' },
    { name: 'kick', chatInputRun: 'chatInputKick', messageRun: 'messageKick' },
    { name: 'timeout', chatInputRun: 'chatInputTimeout', messageRun: 'messageTimeout' },
    { name: 'warn', chatInputRun: 'chatInputWarn', messageRun: 'messageWarn' },
    { name: 'unban', chatInputRun: 'chatInputUnban', messageRun: 'messageUnban' },
    { name: 'case', chatInputRun: 'chatInputCase', messageRun: 'messageCase' },
    { name: 'void', chatInputRun: 'chatInputVoid', messageRun: 'messageVoid' },
    { name: 'history', chatInputRun: 'chatInputHistory', messageRun: 'messageHistory' },
    { name: 'softban', chatInputRun: 'chatInputSoftban', messageRun: 'messageSoftban' },
    { name: 'tempban', chatInputRun: 'chatInputTempban', messageRun: 'messageTempban' },
    { name: 'panel', chatInputRun: 'chatInputPanel', messageRun: 'messagePanel' },
    { name: 'context', chatInputRun: 'chatInputContext', messageRun: 'messageContext' },
    // Voice subcommand group
    {
      name: 'voice',
      type: 'group',
      entries: [
        { name: 'help', default: true, messageRun: 'messageVoiceHelp' },
        { name: 'where', chatInputRun: 'chatInputVoiceWhere', messageRun: 'messageVoiceWhere' },
        { name: 'watch', chatInputRun: 'chatInputVoiceWatch', messageRun: 'messageVoiceWatch' },
        {
          name: 'snapshot',
          chatInputRun: 'chatInputVoiceSnapshot',
          messageRun: 'messageVoiceSnapshot',
        },
        { name: 'track', chatInputRun: 'chatInputVoiceTrack', messageRun: 'messageVoiceTrack' },
      ],
    },
    // Note subcommand group
    {
      name: 'note',
      type: 'group',
      entries: [
        { name: 'help', default: true, messageRun: 'messageNoteHelp' },
        { name: 'add', chatInputRun: 'chatInputNoteAdd', messageRun: 'messageNoteAdd' },
        { name: 'list', chatInputRun: 'chatInputNoteList', messageRun: 'messageNoteList' },
        { name: 'delete', chatInputRun: 'chatInputNoteDelete', messageRun: 'messageNoteDelete' },
      ],
    },
    // Evidence subcommand group
    {
      name: 'evidence',
      type: 'group',
      entries: [
        { name: 'help', default: true, messageRun: 'messageEvidenceHelp' },
        { name: 'add', chatInputRun: 'chatInputEvidenceAdd', messageRun: 'messageEvidenceAdd' },
        { name: 'list', chatInputRun: 'chatInputEvidenceList', messageRun: 'messageEvidenceList' },
      ],
    },

    // Mute subcommand group
    {
      name: 'mute',
      type: 'group',
      entries: [
        { name: 'help', default: true, messageRun: 'messageMuteHelp' },
        { name: 'text', chatInputRun: 'chatInputMuteText', messageRun: 'messageMuteText' },
        { name: 'voice', chatInputRun: 'chatInputMuteVoice', messageRun: 'messageMuteVoice' },
        { name: 'both', chatInputRun: 'chatInputMuteBoth', messageRun: 'messageMuteBoth' },
      ],
    },
    // Unmute subcommand group
    {
      name: 'unmute',
      type: 'group',
      entries: [
        { name: 'help', default: true, messageRun: 'messageUnmuteHelp' },
        { name: 'text', chatInputRun: 'chatInputUnmuteText', messageRun: 'messageUnmuteText' },
        { name: 'voice', chatInputRun: 'chatInputUnmuteVoice', messageRun: 'messageUnmuteVoice' },
        { name: 'both', chatInputRun: 'chatInputUnmuteBoth', messageRun: 'messageUnmuteBoth' },
      ],
    },
    // Mutes list
    { name: 'mutes', chatInputRun: 'chatInputMutesList', messageRun: 'messageMutesList' },
    // Setup wizard
    { name: 'setup', chatInputRun: 'chatInputSetup', messageRun: 'messageSetup' },
  ],
})
export class ModCommand extends Subcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(null) // Show to all users, Gate handles authorization via PermissionGatePrecondition
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(this.buildBanSubcommand)
        .addSubcommand(this.buildKickSubcommand)
        .addSubcommand(this.buildTimeoutSubcommand)
        .addSubcommand(this.buildWarnSubcommand)
        .addSubcommand(this.buildUnbanSubcommand)
        .addSubcommand(this.buildCaseSubcommand)
        .addSubcommand(this.buildVoidSubcommand)
        .addSubcommand(this.buildHistorySubcommand)
        .addSubcommand(this.buildSoftbanSubcommand)
        .addSubcommand(this.buildTempbanSubcommand)
        .addSubcommand(this.buildPanelSubcommand)
        .addSubcommand(this.buildContextSubcommand)
        .addSubcommand(this.buildMutesSubcommand)
        .addSubcommand(this.buildSetupSubcommand)
        .addSubcommandGroup(this.buildVoiceSubcommandGroup.bind(this))
        .addSubcommandGroup(this.buildNoteSubcommandGroup.bind(this))
        .addSubcommandGroup(this.buildEvidenceSubcommandGroup.bind(this))
        .addSubcommandGroup(this.buildMuteSubcommandGroup.bind(this))
        .addSubcommandGroup(this.buildUnmuteSubcommandGroup.bind(this))
    );
  }

  private buildBanSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('ban')
      .setDescription('Ban a member from the server')
      .addUserOption((option) =>
        option.setName('target').setDescription('The member to ban (if in server)')
      )
      .addStringOption((option) =>
        option
          .setName('target_id')
          .setDescription('User ID to ban (for users not in server)')
          .setMinLength(17)
          .setMaxLength(20)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for the ban').setMaxLength(512)
      )
      .addBooleanOption((option) =>
        option.setName('delete_messages').setDescription('Delete messages from the last 7 days')
      );
  }

  private buildKickSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('kick')
      .setDescription('Kick a member from the server')
      .addUserOption((option) =>
        option.setName('target').setDescription('The member to kick').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for the kick').setMaxLength(512)
      );
  }

  private buildTimeoutSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('timeout')
      .setDescription('Timeout a member')
      .addUserOption((option) =>
        option.setName('target').setDescription('The member to timeout').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('duration').setDescription('Duration (e.g., 10m, 1h, 1d)').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for the timeout').setMaxLength(512)
      );
  }

  private buildWarnSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('warn')
      .setDescription('Warn a member')
      .addUserOption((option) =>
        option.setName('target').setDescription('The member to warn').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason for the warning')
          .setRequired(true)
          .setMaxLength(512)
      );
  }

  private buildUnbanSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('unban')
      .setDescription('Unban a user')
      .addStringOption((option) =>
        option.setName('user_id').setDescription('The user ID to unban').setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for the unban').setMaxLength(512)
      );
  }

  private buildCaseSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('case')
      .setDescription('View a moderation case')
      .addIntegerOption((option) =>
        option.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)
      );
  }

  private buildVoidSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('void')
      .setDescription('Void a moderation case (mark as invalid)')
      .addIntegerOption((option) =>
        option.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for voiding the case').setMaxLength(512)
      );
  }

  private buildHistorySubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('history')
      .setDescription('View moderation history for a user')
      .addUserOption((option) =>
        option.setName('target').setDescription('The user to check').setRequired(true)
      );
  }

  private buildSoftbanSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('softban')
      .setDescription('Softban a member (ban + immediate unban to delete messages)')
      .addUserOption((option) =>
        option.setName('target').setDescription('The member to softban (if in server)')
      )
      .addStringOption((option) =>
        option
          .setName('target_id')
          .setDescription('User ID to softban (for users not in server)')
          .setMinLength(17)
          .setMaxLength(20)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for the softban').setMaxLength(512)
      )
      .addIntegerOption((option) =>
        option
          .setName('delete_days')
          .setDescription('Days of messages to delete (default: 7)')
          .setMinValue(1)
          .setMaxValue(7)
      );
  }

  private buildTempbanSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('tempban')
      .setDescription('Temporarily ban a member')
      .addStringOption((option) =>
        option
          .setName('duration')
          .setDescription('Ban duration (e.g., 1h, 1d, 7d)')
          .setRequired(true)
      )
      .addUserOption((option) =>
        option.setName('target').setDescription('The member to tempban (if in server)')
      )
      .addStringOption((option) =>
        option
          .setName('target_id')
          .setDescription('User ID to tempban (for users not in server)')
          .setMinLength(17)
          .setMaxLength(20)
      )
      .addStringOption((option) =>
        option.setName('reason').setDescription('Reason for the tempban').setMaxLength(512)
      )
      .addBooleanOption((option) =>
        option.setName('delete_messages').setDescription('Delete messages from the last 7 days')
      );
  }

  private buildPanelSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('panel')
      .setDescription('Open interactive mod panel for a user')
      .addUserOption((option) =>
        option.setName('target').setDescription('The user to moderate').setRequired(true)
      );
  }

  private buildContextSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('context')
      .setDescription('Get context bundle for a user')
      .addUserOption((option) =>
        option.setName('target').setDescription('The user to get context for').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('window')
          .setDescription('Time window (e.g., 15m, 1h, 24h)')
          .addChoices(
            { name: '15 minutes', value: '15m' },
            { name: '1 hour', value: '1h' },
            { name: '6 hours', value: '6h' },
            { name: '24 hours', value: '24h' },
            { name: '7 days', value: '7d' }
          )
      );
  }

  private buildVoiceSubcommandGroup(group: SlashCommandSubcommandGroupBuilder) {
    return group
      .setName('voice')
      .setDescription('Voice channel monitoring commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('where')
          .setDescription('Check where a user is in voice')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to locate').setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('watch')
          .setDescription("Watch a user's voice activity in real-time")
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to watch').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('duration')
              .setDescription('Watch duration (1m-15m, e.g., 5m, 10m)')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('snapshot')
          .setDescription('Get a snapshot of members in a voice channel')
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('The voice channel to snapshot')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('track')
          .setDescription("Track a voice channel's activity in real-time")
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('The voice channel to track')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          )
          .addStringOption((option) =>
            option
              .setName('duration')
              .setDescription('Track duration (1m-15m, e.g., 5m, 10m)')
              .setRequired(true)
          )
      );
  }

  private buildNoteSubcommandGroup(group: SlashCommandSubcommandGroupBuilder) {
    return group
      .setName('note')
      .setDescription('Manage moderator notes on users')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Add a note to a user')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to add a note to').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('note')
              .setDescription('The note content')
              .setRequired(true)
              .setMaxLength(1000)
          )
          .addStringOption((option) =>
            option.setName('tags').setDescription('Comma-separated tags (e.g., "toxic,raid")')
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List notes for a user')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to list notes for').setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Delete a note by ID')
          .addStringOption((option) =>
            option.setName('note_id').setDescription('The note ID to delete').setRequired(true)
          )
      );
  }

  private buildEvidenceSubcommandGroup(group: SlashCommandSubcommandGroupBuilder) {
    return group
      .setName('evidence')
      .setDescription('Evidence management commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Add evidence to a case (opens dashboard)')
          .addIntegerOption((option) =>
            option.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List evidence for a case')
          .addIntegerOption((option) =>
            option.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)
          )
      );
  }

  private buildMutesSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('mutes')
      .setDescription('List active mutes')
      .addUserOption((option) =>
        option.setName('target').setDescription('Filter by user (optional)')
      )
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Filter by mute type')
          .addChoices(
            { name: 'Text', value: 'TEXT' },
            { name: 'Voice', value: 'VOICE' },
            { name: 'Both', value: 'BOTH' }
          )
      );
  }

  private buildMuteSubcommandGroup(group: SlashCommandSubcommandGroupBuilder) {
    return group
      .setName('mute')
      .setDescription('Mute a user (text, voice, or both)')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('text')
          .setDescription('Mute a user in text channels')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to mute').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the mute')
              .setRequired(true)
              .setMaxLength(512)
          )
          .addStringOption((option) =>
            option
              .setName('duration')
              .setDescription('Duration (e.g., 1h, 1d, 7d) - leave empty for permanent')
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('voice')
          .setDescription('Mute a user in voice channels (server deafen)')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to mute').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the mute')
              .setRequired(true)
              .setMaxLength(512)
          )
          .addStringOption((option) =>
            option
              .setName('duration')
              .setDescription('Duration (e.g., 1h, 1d, 7d) - leave empty for permanent')
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('both')
          .setDescription('Mute a user in both text and voice channels')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to mute').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the mute')
              .setRequired(true)
              .setMaxLength(512)
          )
          .addStringOption((option) =>
            option
              .setName('duration')
              .setDescription('Duration (e.g., 1h, 1d, 7d) - leave empty for permanent')
          )
      );
  }

  private buildUnmuteSubcommandGroup(group: SlashCommandSubcommandGroupBuilder) {
    return group
      .setName('unmute')
      .setDescription('Unmute a user')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('text')
          .setDescription('Remove text mute from a user')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to unmute').setRequired(true)
          )
          .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for the unmute').setMaxLength(512)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('voice')
          .setDescription('Remove voice mute from a user')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to unmute').setRequired(true)
          )
          .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for the unmute').setMaxLength(512)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('both')
          .setDescription('Remove all mutes from a user')
          .addUserOption((option) =>
            option.setName('target').setDescription('The user to unmute').setRequired(true)
          )
          .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for the unmute').setMaxLength(512)
          )
      );
  }

  private buildSetupSubcommand(subcommand: SlashCommandSubcommandBuilder) {
    return subcommand
      .setName('setup')
      .setDescription('Interactive setup wizard for moderation settings (Admin only)');
  }

  public async chatInputBan(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseBanOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleBan(options, new InteractionResponder(interaction));
  }

  public async chatInputKick(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseKickOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleKick(options, new InteractionResponder(interaction));
  }

  public async chatInputTimeout(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseTimeoutOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleTimeout(options, new InteractionResponder(interaction));
  }

  public async chatInputWarn(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseWarnOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleWarn(options, new InteractionResponder(interaction));
  }

  public async chatInputUnban(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseUnbanOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleUnban(options, new InteractionResponder(interaction));
  }

  public async chatInputCase(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseCaseOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleCase(options, new InteractionResponder(interaction));
  }

  public async chatInputVoid(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseVoidOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleCaseVoid(options, new InteractionResponder(interaction));
  }

  public async chatInputHistory(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseHistoryOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleHistory(options, new InteractionResponder(interaction));
  }

  public async chatInputSoftban(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseSoftbanOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleSoftban(options, new InteractionResponder(interaction));
  }

  public async chatInputTempban(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseTempbanOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleTempban(options, new InteractionResponder(interaction));
  }

  public async chatInputPanel(interaction: Subcommand.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const options: PanelOptions = {
      target,
      targetId: target.id,
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
    };
    return handlePanel(options, new InteractionResponder(interaction));
  }

  public async chatInputContext(interaction: Subcommand.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const windowStr = interaction.options.getString('window');
    const windowSeconds = windowStr ? (parseDurationToSeconds(windowStr) ?? undefined) : undefined;
    const options: ContextOptions = {
      target,
      targetId: target.id,
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
      windowSeconds,
    };
    return handleContext(options, new InteractionResponder(interaction));
  }

  // Voice subcommand handlers
  public async chatInputVoiceWhere(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseVoiceWhereOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleVoiceWhere(options, new InteractionResponder(interaction));
  }

  public async chatInputVoiceWatch(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseVoiceWatchOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleVoiceWatch(options, new InteractionResponder(interaction));
  }

  public async chatInputVoiceSnapshot(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseVoiceSnapshotOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleVoiceSnapshot(options, new InteractionResponder(interaction));
  }

  public async chatInputVoiceTrack(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseVoiceTrackOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleVoiceTrack(options, new InteractionResponder(interaction));
  }

  // Note subcommand handlers
  public async chatInputNoteAdd(interaction: Subcommand.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const options: NoteAddOptions = {
      target,
      targetId: target.id,
      content: interaction.options.getString('note', true),
      tags: interaction.options.getString('tags') ?? undefined,
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
      moderator: interaction.user,
    };
    return handleNoteAdd(options, new InteractionResponder(interaction));
  }

  public async chatInputNoteList(interaction: Subcommand.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target', true);
    const options: NoteListOptions = {
      target,
      targetId: target.id,
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
    };
    return handleNoteList(options, new InteractionResponder(interaction));
  }

  public async chatInputNoteDelete(interaction: Subcommand.ChatInputCommandInteraction) {
    const options: NoteDeleteOptions = {
      noteId: interaction.options.getString('note_id', true),
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
      moderator: interaction.user,
    };
    return handleNoteDelete(options, new InteractionResponder(interaction));
  }

  // Evidence subcommand handlers
  public async chatInputEvidenceAdd(interaction: Subcommand.ChatInputCommandInteraction) {
    const options: EvidenceAddOptions = {
      caseNumber: interaction.options.getInteger('number', true),
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
      moderator: interaction.user,
    };
    return handleEvidenceAdd(options, new InteractionResponder(interaction));
  }

  public async chatInputEvidenceList(interaction: Subcommand.ChatInputCommandInteraction) {
    const options: EvidenceListOptions = {
      caseNumber: interaction.options.getInteger('number', true),
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
    };
    return handleEvidenceList(options, new InteractionResponder(interaction));
  }

  // Mute subcommand handlers
  public async chatInputMuteText(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseMuteOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleMuteText(options, new InteractionResponder(interaction));
  }

  public async chatInputMuteVoice(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseMuteOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleMuteVoice(options, new InteractionResponder(interaction));
  }

  public async chatInputMuteBoth(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseMuteOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleMuteBoth(options, new InteractionResponder(interaction));
  }

  // Unmute subcommand handlers
  public async chatInputUnmuteText(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseUnmuteOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleUnmuteText(options, new InteractionResponder(interaction));
  }

  public async chatInputUnmuteVoice(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseUnmuteOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleUnmuteVoice(options, new InteractionResponder(interaction));
  }

  public async chatInputUnmuteBoth(interaction: Subcommand.ChatInputCommandInteraction) {
    let options;
    try {
      options = parseUnmuteOptions(interaction);
    } catch (error) {
      if (error instanceof ValidationError) {
        await interaction.reply(ephemeralError(error.message));
        return;
      }
      throw error;
    }
    return handleUnmuteBoth(options, new InteractionResponder(interaction));
  }

  // Mutes list handler
  public async chatInputMutesList(interaction: Subcommand.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('target') ?? undefined;
    const options: MutesListOptions = {
      target,
      targetId: target?.id,
      muteType: interaction.options.getString('type') ?? undefined,
      guild: interaction.guild!,
      guildId: asGuildId(interaction.guild!.id),
    };
    return handleMutesList(options, new InteractionResponder(interaction));
  }

  // Setup handler
  public async chatInputSetup(interaction: Subcommand.ChatInputCommandInteraction) {
    const options: SetupOptions = {
      guild: interaction.guild!,
      guildId: interaction.guild!.id,
      moderator: interaction.user,
    };
    return handleSetup(options, new InteractionResponder(interaction));
  }

  // Default/Help Handlers (when no subcommand is matched)

  public async messageModHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const p = this.container.client.options.defaultPrefix ?? '!';

    const embed = new EmbedBuilder()
      .setColor(COLORS.DEFAULT)
      .setTitle('Moderation Commands')
      .addFields(
        {
          name: 'Actions',
          value: [
            `\`${p}ban\` / \`${p}b\` \`<user> [reason]\` — Ban a member`,
            `\`${p}kick\` / \`${p}k\` \`<user> <reason>\` — Kick a member`,
            `\`${p}warn\` / \`${p}w\` \`<user> <reason>\` — Warn a member`,
            `\`${p}timeout\` / \`${p}to\` \`<user> <duration> [reason]\` — Timeout`,
            `\`${p}softban\` / \`${p}sb\` \`<user> [reason]\` — Ban + unban`,
            `\`${p}tempban\` / \`${p}tb\` \`<user> <duration> [reason]\` — Temp ban`,
            `\`${p}unban\` / \`${p}ub\` \`<userId> [reason]\` — Unban a user`,
            `\`${p}mute\` / \`${p}m\` \`[text|voice|both] <user> [dur] <reason>\``,
            `\`${p}unmute\` / \`${p}um\` \`[text|voice|both] <user> [reason]\``,
          ].join('\n'),
        },
        {
          name: 'Info',
          value: [
            `\`${p}case\` / \`${p}c\` \`<number>\` — View a case`,
            `\`${p}history\` / \`${p}hist\` \`[user]\` — Moderation history`,
            `\`${p}mod void <number> [reason]\` / \`${p}v <number> [reason]\` — Void a case`,
            `\`${p}mod panel <user>\` — Interactive mod panel`,
            `\`${p}mod context <user> [window]\` — Context bundle`,
            `\`${p}mod mutes [user]\` — List active mutes`,
          ].join('\n'),
        },
        {
          name: 'Voice  (`!mvc`)',
          value: [
            `\`${p}mvc where <user>\` — Locate in voice`,
            `\`${p}mvc watch <user> <duration>\` — Watch activity`,
            `\`${p}mvc snapshot <channel>\` — Snapshot channel`,
            `\`${p}mvc track <channel> <duration>\` — Track channel`,
          ].join('\n'),
          inline: true,
        },
        {
          name: 'Notes  (`!note`, `!n`)',
          value: [
            `\`${p}note add <user> <text>\` — Add a note`,
            `\`${p}note list <user>\` — List notes`,
            `\`${p}note del <noteId>\` — Delete a note`,
          ].join('\n'),
          inline: true,
        },
        {
          name: 'Evidence  (`!ev`)',
          value: [
            `\`${p}ev add <caseNumber>\` — Add evidence`,
            `\`${p}ev list <caseNumber>\` — List evidence`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({ text: 'Use !help to see all commands' });

    return message.channel.send({ embeds: [embed] });
  }

  public async messageVoiceHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Voice Commands** (shortcut: `!voice`)',
        `\`${prefix}voice where <user>\` — Locate user in voice`,
        `\`${prefix}voice watch <user> <duration>\` — Watch voice activity`,
        `\`${prefix}voice snapshot <channel>\` — Snapshot voice channel`,
        `\`${prefix}voice track <channel> <duration>\` — Track voice channel`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }

  public async messageNoteHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Note Commands** (shortcut: `!note`)',
        `\`${prefix}note add <user> <text> [tags]\` — Add a note`,
        `\`${prefix}note list <user>\` — List notes`,
        `\`${prefix}note del <noteId>\` — Delete a note`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }

  public async messageEvidenceHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Evidence Commands** (shortcut: `!ev`)',
        `\`${prefix}ev add <caseNumber>\` — Add evidence to a case`,
        `\`${prefix}ev list <caseNumber>\` — List evidence for a case`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }

  public async messageMuteHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Mute Commands**',
        `\`${prefix}mute <user> [duration] <reason>\` — Mute text + voice (shortcut)`,
        `\`${prefix}mod mute text <user> [duration] <reason>\` — Text mute only`,
        `\`${prefix}mod mute voice <user> [duration] <reason>\` — Voice mute only`,
        `\`${prefix}mod mute both <user> [duration] <reason>\` — Mute text + voice`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }

  public async messageUnmuteHelp(message: Message) {
    if (!message.channel.isSendable()) return;
    const prefix = this.container.client.options.defaultPrefix ?? '!';
    return message.channel.send({
      content: [
        '**Unmute Commands**',
        `\`${prefix}unmute <user> [reason]\` — Unmute text + voice (shortcut)`,
        `\`${prefix}mod unmute text <user> [reason]\` — Remove text mute`,
        `\`${prefix}mod unmute voice <user> [reason]\` — Remove voice mute`,
        `\`${prefix}mod unmute both <user> [reason]\` — Remove all mutes`,
      ].join('\n'),
      allowedMentions: { parse: [] },
    });
  }

  // ============================================================================
  // Message Command Handlers (prefix commands)
  // ============================================================================

  private async handleMessageCommand<T>(
    message: Message,
    args: Args,
    parser: (message: Message, args: Args) => Promise<T>,
    handler: (options: T, ctx: MessageResponder) => Promise<unknown>,
    createsCases = false
  ): Promise<unknown> {
    try {
      const options = await parser(message, args);
      const result = await handler(options, new MessageResponder(message as Message<true>));
      if (createsCases) sendModWelcome(message);
      return result;
    } catch (error) {
      if (error instanceof UserError || error instanceof ValidationError) {
        if (message.channel.isSendable()) {
          return message.channel.send({
            content: buildErrorText(error.message),
            allowedMentions: { parse: [] },
          });
        }
      }
      throw error;
    }
  }

  public async messageBan(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseBanFromMessage, handleBan, true);
  }

  public async messageKick(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseKickFromMessage, handleKick, true);
  }

  public async messageTimeout(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseTimeoutFromMessage, handleTimeout, true);
  }

  public async messageWarn(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseWarnFromMessage, handleWarn, true);
  }

  public async messageUnban(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseUnbanFromMessage, handleUnban);
  }

  public async messageCase(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseCaseFromMessage, handleCase);
  }

  public async messageVoid(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseVoidFromMessage, handleCaseVoid);
  }

  public async messageHistory(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseHistoryFromMessage, handleHistory);
  }

  public async messageSoftban(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseSoftbanFromMessage, handleSoftban, true);
  }

  public async messageTempban(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseTempbanFromMessage, handleTempban, true);
  }

  public async messagePanel(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parsePanelFromMessage, handlePanel);
  }

  public async messageContext(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseContextFromMessage, handleContext);
  }

  // Voice
  public async messageVoiceWhere(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseVoiceWhereFromMessage, handleVoiceWhere);
  }

  public async messageVoiceWatch(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseVoiceWatchFromMessage, handleVoiceWatch);
  }

  public async messageVoiceSnapshot(message: Message, args: Args) {
    return this.handleMessageCommand(
      message,
      args,
      parseVoiceSnapshotFromMessage,
      handleVoiceSnapshot
    );
  }

  public async messageVoiceTrack(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseVoiceTrackFromMessage, handleVoiceTrack);
  }

  // Notes
  public async messageNoteAdd(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseNoteAddFromMessage, handleNoteAdd);
  }

  public async messageNoteList(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseNoteListFromMessage, handleNoteList);
  }

  public async messageNoteDelete(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseNoteDeleteFromMessage, handleNoteDelete);
  }

  // Evidence
  public async messageEvidenceAdd(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseEvidenceAddFromMessage, handleEvidenceAdd);
  }

  public async messageEvidenceList(message: Message, args: Args) {
    return this.handleMessageCommand(
      message,
      args,
      parseEvidenceListFromMessage,
      handleEvidenceList
    );
  }

  // Mute
  public async messageMuteText(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseMuteFromMessage, handleMuteText, true);
  }

  public async messageMuteVoice(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseMuteFromMessage, handleMuteVoice, true);
  }

  public async messageMuteBoth(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseMuteFromMessage, handleMuteBoth, true);
  }

  // Unmute
  public async messageUnmuteText(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseUnmuteFromMessage, handleUnmuteText);
  }

  public async messageUnmuteVoice(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseUnmuteFromMessage, handleUnmuteVoice);
  }

  public async messageUnmuteBoth(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseUnmuteFromMessage, handleUnmuteBoth);
  }

  // Mutes list
  public async messageMutesList(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseMutesListFromMessage, handleMutesList);
  }

  // Setup
  public async messageSetup(message: Message, args: Args) {
    return this.handleMessageCommand(message, args, parseSetupFromMessage, handleSetup);
  }
}
