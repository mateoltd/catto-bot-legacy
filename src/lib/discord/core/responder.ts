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
  type Message,
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

export interface CommandResponder {
  /** Acknowledge the command and show a loading state (ephemeral for interactions) */
  defer(): Promise<void>;
  /** Acknowledge the command with a publicly visible loading state */
  deferPublic(): Promise<void>;
  /** Send an initial response */
  reply(container: MessageContainer): Promise<void>;
  /** Edit a previously deferred response */
  editReply(container: MessageContainer): Promise<Message>;
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

  constructor(interaction: RepliableInteraction) {
    if (!interaction.guild || !interaction.member) {
      throw new Error('InteractionResponder requires a guild interaction');
    }
    this.interaction = interaction;
    this.user = interaction.user;
    this.member = interaction.member as GuildMember;
    this.guild = interaction.guild;
    this.client = interaction.client;
  }

  async defer(): Promise<void> {
    await deferInteraction(this.interaction);
  }

  async deferPublic(): Promise<void> {
    await deferInteraction(this.interaction).public();
  }

  async reply(container: MessageContainer): Promise<void> {
    await replyInteraction(this.interaction, container);
  }

  async editReply(container: MessageContainer): Promise<Message> {
    return editReplyInteraction(this.interaction, container);
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

/**
 * Wraps a Message to implement CommandResponder for prefix commands.
 * - defer() sends a typing indicator and stores a "Processing..." placeholder
 * - reply() sends a Components V2 message to the channel
 * - editReply() edits the stored placeholder message
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
  }

  async defer(): Promise<void> {
    await this.channel.sendTyping();
  }

  async deferPublic(): Promise<void> {
    await this.channel.sendTyping();
  }

  async reply(container: MessageContainer): Promise<void> {
    const resolved = resolveContainer(container);

    await this.channel.send({
      components: [resolved],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
  }

  async editReply(container: MessageContainer): Promise<Message> {
    const resolved = resolveContainer(container);

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
