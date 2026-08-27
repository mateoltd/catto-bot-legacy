/**
 * CommandResponder - Unified response interface for slash and prefix commands
 *
 * Abstracts how handlers send responses regardless of trigger source.
 * InteractionResponder wraps slash command interactions.
 * MessageResponder wraps prefix command messages.
 */

import {
  ContainerBuilder,
  MessageFlags,
  type Client,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type BaseMessageOptions,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type Message,
  type MessageCreateOptions,
  type MessageEditOptions,
  type User,
} from 'discord.js';
import {
  defer as deferInteraction,
  reply as replyInteraction,
  editReply as editReplyInteraction,
  type RepliableInteraction,
  type MessageContainer,
} from './reply.js';
import { buildErrorText, ephemeralError } from '../responses.js';

export { type MessageContainer } from './reply.js';

/**
 * Payload understood by both Discord command transports.
 *
 * Components V2 callers can keep passing a container directly. Commands that
 * return embeds, attachments, or plain content can pass regular Discord message
 * options without reaching around the responder abstraction.
 */
export type CommandResponse =
  | MessageContainer
  | (Omit<BaseMessageOptions, 'content'> & { content?: string | null });

export interface CommandResponder {
  /** Acknowledge the command and show a loading state (ephemeral for interactions) */
  defer(): Promise<void>;
  /** Acknowledge the command with a publicly visible loading state */
  deferPublic(): Promise<void>;
  /** Acknowledge a traditional (non-Components V2) command response */
  deferClassic(): Promise<void>;
  /** Acknowledge a publicly visible traditional command response */
  deferPublicClassic(): Promise<void>;
  /** Send an initial response */
  reply(response: CommandResponse): Promise<void>;
  /** Edit a previously deferred response */
  editReply(response: CommandResponse): Promise<Message>;
  /** Send an error message */
  replyError(message: string): Promise<void>;
  /** The user who triggered the command */
  readonly user: User;
  /** The guild member who triggered the command */
  readonly member: GuildMember;
  /** The guild where the command was triggered */
  readonly guild: Guild;
  /** The Discord client instance */
  readonly client: Client;
  /** Channel in which the command was invoked */
  readonly channelId: string;
}

// ============================================================================
// InteractionResponder
// ============================================================================

/**
 * Wraps a RepliableInteraction to implement CommandResponder.
 * Zero behavior change from existing code paths.
 */
export class InteractionResponder implements CommandResponder {
  private readonly interaction: RepliableInteraction;
  public readonly user: User;
  public readonly member: GuildMember;
  public readonly guild: Guild;
  public readonly client: Client;
  public readonly channelId: string;

  constructor(interaction: RepliableInteraction) {
    if (!interaction.guild || !interaction.member || !interaction.channelId) {
      throw new Error('InteractionResponder requires a guild interaction');
    }
    this.interaction = interaction;
    this.user = interaction.user;
    this.member = interaction.member as GuildMember;
    this.guild = interaction.guild;
    this.client = interaction.client;
    this.channelId = interaction.channelId;
  }

  async defer(): Promise<void> {
    await deferInteraction(this.interaction);
  }

  async deferPublic(): Promise<void> {
    await deferInteraction(this.interaction).public();
  }

  async deferClassic(): Promise<void> {
    await this.interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  async deferPublicClassic(): Promise<void> {
    await this.interaction.deferReply();
  }

  async reply(response: CommandResponse): Promise<void> {
    if (isMessageContainer(response)) {
      await replyInteraction(this.interaction, response);
      return;
    }

    await this.interaction.reply({
      ...toReplyOptions(response),
      flags: MessageFlags.Ephemeral,
      allowedMentions: response.allowedMentions ?? { parse: [] },
    });
  }

  async editReply(response: CommandResponse): Promise<Message> {
    if (isMessageContainer(response)) {
      return editReplyInteraction(this.interaction, response);
    }

    return this.interaction.editReply({
      ...toEditOptions(response),
      allowedMentions: response.allowedMentions ?? { parse: [] },
    });
  }

  async replyError(message: string): Promise<void> {
    await this.interaction.reply(ephemeralError(message));
  }
}

// ============================================================================
// MessageResponder
// ============================================================================

function resolveContainer(container: MessageContainer): ContainerBuilder {
  if ('build' in container && typeof container.build === 'function') {
    return container.build();
  }
  return container as ContainerBuilder;
}

function isMessageContainer(response: CommandResponse): response is MessageContainer {
  return (
    response instanceof ContainerBuilder ||
    ('build' in response && typeof response.build === 'function')
  );
}

function toReplyOptions(
  response: Exclude<CommandResponse, MessageContainer>
): InteractionReplyOptions {
  return {
    ...response,
    content: response.content ?? undefined,
  };
}

function toEditOptions(
  response: Exclude<CommandResponse, MessageContainer>
): InteractionEditReplyOptions {
  return response;
}

function toMessageCreateOptions(
  response: Exclude<CommandResponse, MessageContainer>
): MessageCreateOptions {
  return {
    ...response,
    content: response.content ?? undefined,
  };
}

function toMessageEditOptions(
  response: Exclude<CommandResponse, MessageContainer>
): MessageEditOptions {
  return response;
}

/**
 * Wraps a Message to implement CommandResponder for prefix commands.
 * - defer() sends a typing indicator
 * - reply() sends either a Components V2 or traditional message to the channel
 * - editReply() sends once, then edits that response on subsequent calls
 * - replyError() sends a plain text error to the channel
 */
export class MessageResponder implements CommandResponder {
  public readonly source: Message<true>;
  private readonly channel: GuildTextBasedChannel;
  private deferredMessage: Message | null = null;
  public readonly user: User;
  public readonly member: GuildMember;
  public readonly guild: Guild;
  public readonly client: Client;
  public readonly channelId: string;

  constructor(message: Message<true>) {
    if (!message.member) {
      throw new Error('MessageResponder requires a message with member data');
    }
    this.source = message;
    this.channel = message.channel;
    this.user = message.author;
    this.member = message.member;
    this.guild = message.guild;
    this.client = message.client;
    this.channelId = message.channelId;
  }

  async defer(): Promise<void> {
    await this.channel.sendTyping();
  }

  async deferPublic(): Promise<void> {
    await this.channel.sendTyping();
  }

  async deferClassic(): Promise<void> {
    await this.channel.sendTyping();
  }

  async deferPublicClassic(): Promise<void> {
    await this.channel.sendTyping();
  }

  async reply(response: CommandResponse): Promise<void> {
    if (!isMessageContainer(response)) {
      await this.channel.send({
        ...toMessageCreateOptions(response),
        allowedMentions: response.allowedMentions ?? { parse: [] },
      });
      return;
    }

    const resolved = resolveContainer(response);

    await this.channel.send({
      components: [resolved],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
  }

  async editReply(response: CommandResponse): Promise<Message> {
    if (!isMessageContainer(response)) {
      if (this.deferredMessage) {
        return this.deferredMessage.edit({
          ...toMessageEditOptions(response),
          allowedMentions: response.allowedMentions ?? { parse: [] },
        });
      }

      const msg = await this.channel.send({
        ...toMessageCreateOptions(response),
        allowedMentions: response.allowedMentions ?? { parse: [] },
      });
      this.deferredMessage = msg;
      return msg;
    }

    const resolved = resolveContainer(response);

    // If we have a deferred placeholder, edit it
    if (this.deferredMessage) {
      return this.deferredMessage.edit({
        content: '',
        components: [resolved],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }

    // Otherwise send a new message and store it
    const msg = await this.channel.send({
      components: [resolved],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
    this.deferredMessage = msg;
    return msg;
  }

  async replyError(message: string): Promise<void> {
    await this.channel.send({
      content: buildErrorText(message),
      allowedMentions: { parse: [] },
    });
  }
}
