import { AllFlowsPrecondition, type Command } from '@sapphire/framework';
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  GuildMember,
  Message,
} from 'discord.js';
import { Gate, isFail } from '#lib/validation/Gate.js';
import { getGate } from '#lib/validation/gateContext.js';
import {
  resolveCommandKey,
  resolveContextMenuKey,
  resolveMessageCommandKey,
} from '#lib/validation/resourceKey.js';

/**
 * Global precondition that gates all commands through the Gate validation system.
 *
 * This precondition runs before every command and uses Gate.checkAuth() to:
 * 1. Check if the user has permission via custom grants
 * 2. Fall back to Discord permissions if no grant exists
 * 3. Return an error that triggers chatInputCommandDenied listener
 *
 * Note: This only checks authorization, not hierarchy.
 * Hierarchy checks are done by individual commands using Gate.requirePunitive() or Gate.checkHierarchy().
 *
 * This precondition uses the shared Gate context from gateContext.ts, ensuring
 * the same Gate instance is reused throughout the interaction lifecycle.
 */
export class PermissionGatePrecondition extends AllFlowsPrecondition {
  public constructor(
    context: AllFlowsPrecondition.LoaderContext,
    options: AllFlowsPrecondition.Options
  ) {
    super(context, {
      ...options,
      name: 'PermissionGate',
      position: 20,
    });
  }

  public override async messageRun(message: Message, command: Command) {
    if (!message.guild || !message.member) return this.ok();

    const gate = Gate.fromMember(message.member as GuildMember, message.guild);
    const commandKey = resolveMessageCommandKey(command.name, message);
    const result = await gate.checkAuth(commandKey);

    if (isFail(result)) {
      return this.error({
        identifier: 'PermissionDenied',
        message: result.message,
        context: { commandKey, code: result.code, response: result.response },
      });
    }

    return this.ok();
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    // Use the shared Gate context (already initialized by 00-gateContext.ts listener)
    const gate = getGate(interaction);

    // Not in guild - allow (DM commands don't need permission checks)
    if (!gate) {
      return this.ok();
    }

    // Use unified resource key resolution
    const commandKey = resolveCommandKey(interaction);
    const result = await gate.checkAuth(commandKey);

    if (isFail(result)) {
      return this.error({
        identifier: 'PermissionDenied',
        message: result.message,
        context: { commandKey, code: result.code, response: result.response },
      });
    }

    return this.ok();
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    // Use the shared Gate context
    const gate = getGate(interaction);

    // Not in guild - allow
    if (!gate) {
      return this.ok();
    }

    // Use unified resource key resolution
    const commandKey = resolveContextMenuKey(interaction);
    const result = await gate.checkAuth(commandKey);

    if (isFail(result)) {
      return this.error({
        identifier: 'PermissionDenied',
        message: result.message,
        context: { commandKey, code: result.code, response: result.response },
      });
    }

    return this.ok();
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    PermissionGate: never;
  }
}
