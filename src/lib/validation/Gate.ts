/**
 * Validation Gate - Centralized validation for commands and interactions
 *
 * This module provides a unified gate that intercepts all validation concerns:
 * - Authorization (permission grants, Discord permissions)
 * - Hierarchy (role position, owner, bot targets)
 * - Target resolution
 * - Automatic error responses
 *
 * Design principles:
 * - Single point of entry for all validation
 * - Composable checks with clean result types
 * - Auto-response on failure (no manual error handling needed)
 * - Type-safe with discriminated unions
 *
 * @example
 * ```ts
 * // For non-punitive commands
 * const gate = Gate.from(interaction);
 * if (!gate || !await gate.requireAuth('mod.history')) return;
 *
 * // For punitive commands
 * const gate = Gate.from(interaction);
 * if (!gate) return;
 * const target = await gate.requirePunitive('mod.warn', targetId);
 * if (!target) return; // Error already sent
 * ```
 */

import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import {
  checkCommandAccess,
  checkResourceAccess,
  type ResourceAccessResult,
} from './permissionResolver.js';
import { getCommand, fallbackDiscordPermissionForCommand } from './permissionRegistry.js';
import { errorMessage, type FluentContainer } from '../discord/containers/index.js';
import { reply, editReply } from '../discord/core/reply.js';
import type { CommandResponder } from '../discord/core/responder.js';

// Types

/** Interactions that can be gated */
export type GateableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | ContextMenuCommandInteraction
  | StringSelectMenuInteraction;

/** Error codes for gate failures */
export const GateErrorCode = {
  // Authorization
  NO_PERMISSION: 'NO_PERMISSION',
  EXPLICIT_DENY: 'EXPLICIT_DENY',

  // Context
  NOT_IN_GUILD: 'NOT_IN_GUILD',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  TARGET_NOT_MEMBER: 'TARGET_NOT_MEMBER',

  // Hierarchy
  SELF_TARGET: 'SELF_TARGET',
  OWNER_TARGET: 'OWNER_TARGET',
  BOT_TARGET: 'BOT_TARGET',
  HIGHER_ROLE: 'HIGHER_ROLE',
  BOT_CANNOT_ACT: 'BOT_CANNOT_ACT',

  // Resource-level
  RATE_LIMITED: 'RATE_LIMITED',
  WEIGHT_EXCEEDED: 'WEIGHT_EXCEEDED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
} as const;

// eslint-disable-next-line no-redeclare -- TypeScript pattern: const + type with same name
export type GateErrorCode = (typeof GateErrorCode)[keyof typeof GateErrorCode];

/** Successful gate result */
interface GatePass {
  readonly ok: true;
}

/** Failed gate result */
interface GateFail {
  readonly ok: false;
  readonly code: GateErrorCode;
  /** Plain text message for logging/internal use */
  readonly message: string;
  /** DCB container for user-facing responses */
  readonly response: FluentContainer;
}

/** Result of a gate check */
export type GateResult = GatePass | GateFail;

/** Type guard for failed results */
export function isFail(result: GateResult): result is GateFail {
  return !result.ok;
}

/** Create a pass result */
function pass(): GatePass {
  return { ok: true };
}

/** Create a fail result with DCB container */
function fail(code: GateErrorCode, title: string, message: string): GateFail {
  return {
    ok: false,
    code,
    message,
    response: errorMessage(title, message),
  };
}

// Gate Class

/**
 * Centralized validation gate for commands and interactions.
 *
 * Provides a clean API for:
 * - Authorization checks (permission grants)
 * - Hierarchy validation (role positions)
 * - Target resolution
 * - Automatic error responses
 */
export class Gate {
  private constructor(
    /** The interaction being validated (null for message commands) */
    public readonly interaction: GateableInteraction | null,
    /** The guild member executing the interaction */
    public readonly member: GuildMember,
    /** The guild context */
    public readonly guild: Guild
  ) {}

  // ===========================================================================
  // Factory
  // ===========================================================================

  /**
   * Create a Gate from an interaction.
   *
   * @returns Gate instance, or null if not in a guild context
   */
  static from(interaction: GateableInteraction): Gate | null {
    if (!interaction.guild || !interaction.member) {
      return null;
    }

    return new Gate(interaction, interaction.member as GuildMember, interaction.guild);
  }

  /**
   * Create a Gate and immediately fail if not in guild context.
   * Sends an ephemeral error automatically.
   *
   * @returns Gate instance, or null (error already sent)
   */
  static async require(interaction: GateableInteraction): Promise<Gate | null> {
    const gate = Gate.from(interaction);

    if (!gate) {
      try {
        await reply(
          interaction,
          errorMessage('Server Only', 'This command can only be used in a server.')
        );
      } catch {
        // Interaction may have expired
      }
      return null;
    }

    return gate;
  }

  /**
   * Create a Gate from a guild member directly (no interaction needed).
   * Used for message/prefix commands where there is no interaction object.
   */
  static fromMember(member: GuildMember, guild: Guild): Gate {
    return new Gate(null, member, guild);
  }

  // ===========================================================================
  // Authorization
  // ===========================================================================

  /**
   * Check if the member is authorized to use a command.
   * Checks custom permission grants first, then falls back to Discord permissions.
   */
  async checkAuth(commandKey: string): Promise<GateResult> {
    const accessResult = await checkCommandAccess(this.member, commandKey);

    if (accessResult.allowed) {
      return pass();
    }

    // Explicit deny from grants
    if (accessResult.reason === 'explicit_deny' || accessResult.reason === 'category_deny') {
      return fail(
        GateErrorCode.EXPLICIT_DENY,
        'Access Denied',
        'You have been explicitly denied access to this command.'
      );
    }

    // No permission (either Discord or grant)
    const command = getCommand(commandKey);
    const fallbackPerm = fallbackDiscordPermissionForCommand(commandKey);
    const displayName = command?.displayName ?? commandKey;

    const message = fallbackPerm
      ? `You need the required Discord permission or a custom grant for \`${displayName}\`.`
      : `You don't have permission to use \`${displayName}\`.`;

    return fail(GateErrorCode.NO_PERMISSION, 'Permission Denied', message);
  }

  /**
   * Require authorization for a command.
   * Automatically sends error response on failure.
   *
   * @param commandKey - The command key (e.g., 'mod.warn')
   * @param ctx - Optional CommandResponder for message command support
   * @returns true if authorized, false if denied (error already sent)
   */
  async requireAuth(commandKey: string, ctx?: CommandResponder): Promise<boolean> {
    const result = await this.checkAuth(commandKey);
    if (isFail(result)) {
      await this.deny(result, ctx);
      return false;
    }
    return true;
  }

  // ===========================================================================
  // Resource-Level Authorization
  // ===========================================================================

  /**
   * Check resource-level authorization.
   * Extends command-level auth with resource context metadata.
   */
  async checkResourceAuth(
    commandKey: string,
    context?: { caseId?: string; ownerId?: string }
  ): Promise<GateResult> {
    const accessResult: ResourceAccessResult = await checkResourceAccess(
      this.member,
      commandKey,
      context
    );

    if (accessResult.allowed) {
      return pass();
    }

    if (accessResult.reason === 'explicit_deny' || accessResult.reason === 'category_deny') {
      return fail(
        GateErrorCode.EXPLICIT_DENY,
        'Access Denied',
        accessResult.metadata?.disabledReason ??
          'You have been explicitly denied access to this resource.'
      );
    }

    return fail(
      GateErrorCode.INSUFFICIENT_SCOPE,
      'Insufficient Scope',
      accessResult.metadata?.disabledReason ?? `You don't have permission to access this resource.`
    );
  }

  /**
   * Require resource-level authorization.
   * Automatically sends error response on failure.
   *
   * @param commandKey - The command key
   * @param context - Optional resource context
   * @param ctx - Optional CommandResponder for message command support
   * @returns true if authorized, false if denied (error already sent)
   */
  async requireResourceAuth(
    commandKey: string,
    context?: { caseId?: string; ownerId?: string },
    ctx?: CommandResponder
  ): Promise<boolean> {
    const result = await this.checkResourceAuth(commandKey, context);
    if (isFail(result)) {
      await this.deny(result, ctx);
      return false;
    }
    return true;
  }

  // ===========================================================================
  // Hierarchy
  // ===========================================================================

  /**
   * Check if the member can moderate a target based on role hierarchy.
   *
   * Rules:
   * - Cannot moderate yourself
   * - Cannot moderate server owner
   * - Cannot moderate bots (unless Administrator)
   * - Cannot moderate users with equal/higher role
   * - Bot must be able to act on target (Discord-enforced)
   */
  checkHierarchy(target: GuildMember): GateResult {
    // Self
    if (this.member.id === target.id) {
      return fail(
        GateErrorCode.SELF_TARGET,
        'Invalid Target',
        'You cannot perform this action on yourself.'
      );
    }

    // Server owner
    if (target.id === this.guild.ownerId) {
      return fail(
        GateErrorCode.OWNER_TARGET,
        'Cannot Moderate',
        'You cannot perform this action on the server owner.'
      );
    }

    // Bots require Administrator
    if (target.user.bot && !this.member.permissions.has('Administrator')) {
      return fail(
        GateErrorCode.BOT_TARGET,
        'Cannot Moderate',
        'You cannot perform this action on bots.'
      );
    }

    // Role hierarchy
    if (target.roles.highest.position >= this.member.roles.highest.position) {
      return fail(
        GateErrorCode.HIGHER_ROLE,
        'Cannot Moderate',
        'Target has equal or higher role than you.'
      );
    }

    // Bot capability (can't bypass - Discord enforces)
    const botMember = this.guild.members.me;
    if (botMember && target.roles.highest.position >= botMember.roles.highest.position) {
      return fail(
        GateErrorCode.BOT_CANNOT_ACT,
        'Cannot Moderate',
        'I cannot perform this action on users with equal or higher role than me.'
      );
    }

    return pass();
  }

  // ===========================================================================
  // Combined Checks
  // ===========================================================================

  /**
   * Full validation for punitive actions.
   *
   * Performs:
   * 1. Authorization check
   * 2. Target resolution
   * 3. Hierarchy check (if target is a member)
   *
   * @param commandKey - The command key (e.g., 'mod.warn')
   * @param targetId - Discord user ID to target
   * @param options - Additional options
   * @returns Target GuildMember if all checks pass, null otherwise (error already sent)
   */
  async requirePunitive(
    commandKey: string,
    targetId: string,
    options: {
      /** Whether target must be a guild member. Default: true */
      requiresMember?: boolean;
      /** Optional CommandResponder for message command support */
      ctx?: CommandResponder;
    } = {}
  ): Promise<GuildMember | null> {
    const { requiresMember = true, ctx } = options;

    // 1. Authorization
    const authResult = await this.checkAuth(commandKey);
    if (isFail(authResult)) {
      await this.deny(authResult, ctx);
      return null;
    }

    // 2. Resolve target
    let targetMember: GuildMember | null = null;
    try {
      targetMember = await this.guild.members.fetch(targetId);
    } catch {
      // Target not in server
    }

    // 3. Member required check
    if (requiresMember && !targetMember) {
      await this.deny(
        fail(GateErrorCode.TARGET_NOT_MEMBER, 'User Not Found', 'User is not in this server.'),
        ctx
      );
      return null;
    }

    // 4. Hierarchy check (only if we have a member)
    if (targetMember) {
      const hierarchyResult = this.checkHierarchy(targetMember);
      if (isFail(hierarchyResult)) {
        await this.deny(hierarchyResult, ctx);
        return null;
      }
    }

    return targetMember;
  }

  /**
   * Quick punitive check when you already have the target member.
   *
   * @param commandKey - The command key (e.g., 'mod.warn')
   * @param targetMember - The target guild member
   * @param ctx - Optional CommandResponder for message command support
   * @returns true if action is allowed, false otherwise (error already sent)
   */
  async requirePunitiveWithMember(
    commandKey: string,
    targetMember: GuildMember,
    ctx?: CommandResponder
  ): Promise<boolean> {
    // Authorization
    const authResult = await this.checkAuth(commandKey);
    if (isFail(authResult)) {
      await this.deny(authResult, ctx);
      return false;
    }

    // Hierarchy
    const hierarchyResult = this.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await this.deny(hierarchyResult, ctx);
      return false;
    }

    return true;
  }

  // ===========================================================================
  // Response Handling
  // ===========================================================================

  /**
   * Send an error response for a failed gate check.
   * Handles deferred/replied state automatically.
   *
   * @param result - The failed gate result
   * @param ctx - Optional CommandResponder for message command support
   * @returns Always returns true (for early-return pattern)
   */
  async deny(result: GateFail, ctx?: CommandResponder): Promise<true> {
    try {
      if (ctx) {
        await ctx.editReply(result.response);
      } else if (this.interaction) {
        if (this.interaction.deferred || this.interaction.replied) {
          await editReply(this.interaction, result.response);
        } else {
          await reply(this.interaction, result.response);
        }
      }
    } catch {
      // Interaction may have expired or failed
    }

    return true;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Resolve a user ID to a GuildMember.
   *
   * @returns GuildMember if found, null otherwise
   */
  async resolveMember(userId: string): Promise<GuildMember | null> {
    try {
      return await this.guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  /**
   * Check if the member has Administrator permission.
   */
  get isAdmin(): boolean {
    return this.member.permissions.has('Administrator');
  }

  /**
   * Check if the member is the server owner.
   */
  get isOwner(): boolean {
    return this.member.id === this.guild.ownerId;
  }
}

// Helpers

/**
 * Build a command key from interaction data.
 */
export function buildCommandKey(
  commandName: string,
  subcommandGroup: string | null,
  subcommand: string | null
): string {
  const parts = [commandName];
  if (subcommandGroup) parts.push(subcommandGroup);
  if (subcommand) parts.push(subcommand);
  return parts.join('.');
}
