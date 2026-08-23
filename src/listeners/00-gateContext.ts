/**
 * Gate Context Initialization Listener
 *
 * This listener runs early (before other InteractionCreate listeners) to:
 * 1. Initialize the Gate context for the interaction
 * 2. Install the `interaction.gate` getter for convenient access
 *
 * The "00-" prefix ensures this listener loads before others alphabetically.
 * However, the implementation is idempotent, so exact ordering is not critical
 * for correctness—only for performance (avoiding redundant Gate creation).
 *
 * After this listener runs, any code can access the Gate via:
 * - `interaction.gate` (TypeScript-augmented getter)
 * - `getGate(interaction)` (explicit accessor function)
 */

import { Listener } from '@sapphire/framework';
import { Events, type Interaction } from 'discord.js';
import { initializeGateForInteraction, installGateGetter } from '#lib/validation/gateContext.js';

export class GateContextListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.InteractionCreate,
    });
  }

  public run(interaction: Interaction): void {
    // Install the gate getter on the interaction object
    // This makes `interaction.gate` available
    installGateGetter(interaction);

    // Pre-initialize the Gate in the WeakMap cache
    // This ensures subsequent `getGate()` calls are instant
    initializeGateForInteraction(interaction);
  }
}
