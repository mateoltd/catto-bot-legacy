/**
 * Fluent Reply Helpers for Discord Interactions
 *
 * Clean API for sending component-based messages.
 * Handles flags automatically.
 *
 * @example
 * ```ts
 * await defer(interaction);           // ephemeral
 * await defer(interaction).public();  // visible
 * await reply(interaction, container);
 * const msg = await editReply(interaction, container);
 * ```
 */

import {
  DiscordAPIError,
  MessageFlags,
  ContainerBuilder,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type Message,
} from 'discord.js';
import type { FluentContainer } from '../containers/container.js';

export type RepliableInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;

export type MessageContainer = ContainerBuilder | FluentContainer;

const COMPONENTS_V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const COMPONENTS_V2_EPHEMERAL = COMPONENTS_V2 | EPHEMERAL;

/**
 * Discord API error code for invalid form body
 */
const DISCORD_ERROR_INVALID_FORM_BODY = 50035;

function resolveContainer(container: MessageContainer): ContainerBuilder {
  if ('build' in container && typeof container.build === 'function') {
    return container.build();
  }
  return container as ContainerBuilder;
}

/**
 * Wraps Discord API errors to provide more helpful error messages,
 * especially for Components V2 related issues.
 */
function wrapComponentsV2Error(error: unknown, context: string): never {
  if (error instanceof DiscordAPIError && error.code === DISCORD_ERROR_INVALID_FORM_BODY) {
    const rawError = error.rawError as { errors?: Record<string, unknown> };
    const errorStr = JSON.stringify(rawError);

    // Check for common Components V2 errors
    if (errorStr.includes('UNION_TYPE_CHOICES') || errorStr.includes('type')) {
      throw new Error(
        `[DCB] Components V2 error in ${context}: Missing MessageFlags.IsComponentsV2 flag or invalid component structure. ` +
          `Original error: ${error.message}`
      );
    }
  }
  throw error;
}

/**
 * Fluent defer builder
 */
class DeferBuilder implements PromiseLike<void> {
  private interaction: RepliableInteraction;
  private isEphemeral = true;

  constructor(interaction: RepliableInteraction) {
    this.interaction = interaction;
  }

  public(): this {
    this.isEphemeral = false;
    return this;
  }

  private async execute(): Promise<void> {
    const flags = this.isEphemeral ? COMPONENTS_V2_EPHEMERAL : COMPONENTS_V2;
    await this.interaction.deferReply({ flags: flags as number });
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Defer a reply. Ephemeral by default, chain .public() for visible.
 */
export function defer(interaction: RepliableInteraction): DeferBuilder {
  return new DeferBuilder(interaction);
}

/**
 * Fluent reply builder
 */
class ReplyBuilder implements PromiseLike<void> {
  private interaction: RepliableInteraction;
  private container: MessageContainer;
  private isEphemeral = true;

  constructor(interaction: RepliableInteraction, container: MessageContainer) {
    this.interaction = interaction;
    this.container = container;
  }

  public(): this {
    this.isEphemeral = false;
    return this;
  }

  private async execute(): Promise<void> {
    const resolved = resolveContainer(this.container);
    const flags = this.isEphemeral ? COMPONENTS_V2_EPHEMERAL : COMPONENTS_V2;

    const options: InteractionReplyOptions = {
      components: [resolved],
      flags,
      allowedMentions: { parse: [] },
    };

    await this.interaction.reply(options);
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Reply with a container. Ephemeral by default, chain .public() for visible.
 */
export function reply(
  interaction: RepliableInteraction,
  container: MessageContainer
): ReplyBuilder {
  return new ReplyBuilder(interaction, container);
}

/**
 * Edit a previously deferred reply. Returns the message for further use.
 */
export async function editReply(
  interaction: RepliableInteraction,
  container: MessageContainer
): Promise<Message> {
  const resolved = resolveContainer(container);

  const options: InteractionEditReplyOptions = {
    components: [resolved],
    flags: COMPONENTS_V2,
    allowedMentions: { parse: [] },
  };

  try {
    return await interaction.editReply(options);
  } catch (error) {
    wrapComponentsV2Error(error, 'editReply');
  }
}
