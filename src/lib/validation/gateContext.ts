/**
 * Gate Context - High-penetration Gate availability for all interactions
 *
 * This module provides automatic Gate availability for every Discord interaction
 * through a WeakMap-based context layer and an optional `interaction.gate` getter.
 *
 * Benefits:
 * - No mutation of Discord.js objects (WeakMap)
 * - No memory leaks (WeakMap cleans up automatically)
 * - Works across all listener/command code
 * - Single source of truth for Gate instances per interaction
 *
 * @example
 * ```ts
 * // Using the accessor function
 * const gate = getGate(interaction);
 * if (!gate) return; // Not in guild
 * await gate.requireAuth('mod.warn');
 *
 * // Using the TypeScript-augmented getter (after InteractionCreate listener runs)
 * const gate = interaction.gate;
 * if (!gate) return;
 * await gate.requireAuth('mod.warn');
 * ```
 */

import type { Interaction } from 'discord.js';
import { Gate, type GateableInteraction } from './Gate.js';

// WeakMap Context Store

/**
 * WeakMap storing Gate instances per interaction.
 * WeakMap ensures no memory leaks - entries are automatically cleaned up
 * when the interaction is garbage collected.
 *
 * We use `object` as the key type since WeakMap requires object keys,
 * and all interaction types are objects.
 */
const gateCache = new WeakMap<object, Gate | null>();

/**
 * Check if an interaction has a cached Gate (or null, meaning it was checked).
 */
export function hasGateCached(interaction: Interaction): boolean {
  return gateCache.has(interaction);
}

/**
 * Get or create a Gate for the given interaction.
 *
 * This function is idempotent - it will return the same Gate instance
 * for the same interaction, creating it only once.
 *
 * @param interaction - Any gateable interaction
 * @returns Gate instance, or null if not in a guild context
 */
export function getGate(interaction: GateableInteraction): Gate | null {
  // Check cache first
  if (gateCache.has(interaction)) {
    return gateCache.get(interaction) ?? null;
  }

  // Create and cache
  const gate = Gate.from(interaction);
  gateCache.set(interaction, gate);
  return gate;
}

/**
 * Get Gate for any interaction type, coercing to GateableInteraction if possible.
 * Used by the global InteractionCreate listener.
 */
export function getGateFromAnyInteraction(interaction: Interaction): Gate | null {
  if (!isGateableInteraction(interaction)) {
    return null;
  }
  return getGate(asGateableInteraction(interaction));
}

/**
 * Pre-cache a Gate for an interaction.
 * Called by the global InteractionCreate listener to ensure Gate is available early.
 */
export function initializeGateForInteraction(interaction: Interaction): void {
  if (isGateableInteraction(interaction) && !gateCache.has(interaction)) {
    const gate = Gate.from(asGateableInteraction(interaction));
    gateCache.set(interaction, gate);
  }
}

// Type Guards

/**
 * Check if an interaction is a type that can be gated.
 * Returns true if the interaction is one of the gateable types.
 */
export function isGateableInteraction(interaction: Interaction): boolean {
  return (
    interaction.isChatInputCommand() ||
    interaction.isButton() ||
    interaction.isModalSubmit() ||
    interaction.isContextMenuCommand() ||
    interaction.isStringSelectMenu()
  );
}

/**
 * Assert that an interaction is gateable and return it typed correctly.
 * Throws if the interaction is not gateable.
 */
export function asGateableInteraction(interaction: Interaction): GateableInteraction {
  if (!isGateableInteraction(interaction)) {
    throw new Error(`Interaction type ${interaction.type} is not gateable`);
  }
  // Safe cast since we verified the type
  return interaction as unknown as GateableInteraction;
}

// TypeScript Augmentation for interaction.gate

/**
 * Symbol used to store the Gate getter on interaction objects.
 * Using a symbol prevents conflicts with future Discord.js properties.
 */
const GATE_SYMBOL = Symbol.for('catto.gate');

/**
 * Install the non-enumerable `gate` getter on an interaction.
 * This makes `interaction.gate` available as a convenient accessor.
 */
export function installGateGetter(interaction: Interaction): void {
  if (GATE_SYMBOL in interaction) {
    return; // Already installed
  }

  Object.defineProperty(interaction, 'gate', {
    get(this: Interaction): Gate | null {
      if (!isGateableInteraction(this)) {
        return null;
      }
      return getGate(asGateableInteraction(this));
    },
    enumerable: false,
    configurable: false,
  });

  // Mark as installed
  Object.defineProperty(interaction, GATE_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

// Helper Functions for Common Patterns

/**
 * Require a Gate for the interaction, sending an error if not in guild.
 * Shorthand for `Gate.require(interaction)` using the cached Gate.
 *
 * @returns Gate if available, null if not (error already sent)
 */
export async function requireGate(interaction: GateableInteraction): Promise<Gate | null> {
  const gate = getGate(interaction);

  if (!gate) {
    return Gate.require(interaction);
  }

  return gate;
}

/**
 * Require authorization for a resource key.
 * Combines Gate retrieval and auth check in one call.
 *
 * @returns true if authorized, false if denied (error already sent)
 */
export async function requireAuth(
  interaction: GateableInteraction,
  resourceKey: string
): Promise<boolean> {
  const gate = await requireGate(interaction);
  if (!gate) return false;
  return gate.requireAuth(resourceKey);
}

/**
 * Full punitive validation: auth + target resolution + hierarchy.
 *
 * @returns Target GuildMember if all checks pass, null otherwise (error already sent)
 */
export async function requirePunitive(
  interaction: GateableInteraction,
  resourceKey: string,
  targetId: string,
  options: { requiresMember?: boolean } = {}
): Promise<import('discord.js').GuildMember | null> {
  const gate = await requireGate(interaction);
  if (!gate) return null;
  return gate.requirePunitive(resourceKey, targetId, options);
}

// Message Command Helpers

/**
 * Create a Gate from a guild member directly (no interaction needed).
 * Used for message/prefix commands.
 */
export function getGateFromMember(
  member: import('discord.js').GuildMember,
  guild: import('discord.js').Guild
): Gate {
  return Gate.fromMember(member, guild);
}

// TypeScript Module Augmentation

declare module 'discord.js' {
  interface ChatInputCommandInteraction {
    readonly gate: Gate | null;
  }

  interface ButtonInteraction {
    readonly gate: Gate | null;
  }

  interface ModalSubmitInteraction {
    readonly gate: Gate | null;
  }

  interface ContextMenuCommandInteraction {
    readonly gate: Gate | null;
  }

  interface StringSelectMenuInteraction {
    readonly gate: Gate | null;
  }
}
