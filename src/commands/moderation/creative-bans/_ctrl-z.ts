/**
 * Creative Ban: Ctrl-Z
 *
 * "Undoes" the user's server presence step by step:
 * - Phase 1: Deletes their recent messages one by one
 * - Phase 2: Removes their roles one by one
 * - Phase 3: Shows an "undoing server join" progress counter, then bans
 */

import { container } from '@sapphire/framework';
import { type GuildMember, type Message, type TextChannel } from 'discord.js';
import { executeCreativeBan, delay } from './_shared.js';

const MSG_DELETE_LIMIT = 10;
const MSG_DELETE_DELAY_MS = 800;
const ROLE_REMOVE_DELAY_MS = 1200;
const PROGRESS_STEPS = 10;
const PROGRESS_STEP_DELAY_MS = 600;

/**
 * Build a progress bar string.
 */
function buildProgressBar(current: number, total: number): string {
  const filled = Math.floor((current / total) * 20);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = Math.floor((current / total) * 100);
  return `\`[${bar}]\` ${pct}%`;
}

/**
 * Execute the ctrl-z creative ban sequence.
 */
export async function executeCtrlZ(message: Message, target: GuildMember): Promise<void> {
  const guild = message.guild!;
  const moderator = message.author;
  const channel = message.channel as TextChannel;

  try {
    const statusMsg = await channel.send(
      `⌨️ **Ctrl+Z** detectado... Deshaciendo a **${target.user.tag}**...`
    );

    // =========================================================================
    // Phase 1: Delete recent messages
    // =========================================================================
    await delay(1500);
    await statusMsg.edit(`⌨️ **Fase 1/3:** Deshaciendo mensajes de **${target.user.tag}**...`);

    // Search for recent messages in text channels (cap at 10 channels to avoid rate limits)
    let deletedCount = 0;
    const textChannels = [
      ...guild.channels.cache.filter((ch) => ch.isTextBased() && 'messages' in ch).values(),
    ].slice(0, 10);

    for (const ch of textChannels) {
      if (deletedCount >= MSG_DELETE_LIMIT) break;
      if (!ch.isTextBased() || !('messages' in ch)) continue;

      try {
        const messages = await ch.messages.fetch({ limit: 50 });
        const targetMessages = messages.filter((m) => m.author.id === target.id);

        for (const msg of targetMessages.values()) {
          if (deletedCount >= MSG_DELETE_LIMIT) break;
          try {
            await msg.delete();
            deletedCount++;
            await delay(MSG_DELETE_DELAY_MS);
          } catch {
            // Message may be too old or already deleted
          }
        }
      } catch {
        // Channel may not be accessible
      }
    }

    await statusMsg.edit(`⌨️ **Fase 1/3:** ✅ ${deletedCount} mensaje(s) deshecho(s).`);

    // =========================================================================
    // Phase 2: Remove roles one by one
    // =========================================================================
    await delay(1000);
    const rolesToRemove = target.roles.cache
      .filter((role) => role.id !== guild.id && role.editable)
      .sort((a, b) => a.position - b.position);

    let removedRoles = 0;
    const totalRoles = rolesToRemove.size;

    if (totalRoles > 0) {
      const roleMsg = await channel.send(`⌨️ **Fase 2/3:** Deshaciendo roles... (0/${totalRoles})`);

      for (const role of rolesToRemove.values()) {
        try {
          await target.roles.remove(role, 'Creative ban: ctrl-z');
          removedRoles++;
          await roleMsg.edit(
            `⌨️ **Fase 2/3:** Deshaciendo roles... (${removedRoles}/${totalRoles}) — \`-${role.name}\``
          );
          await delay(ROLE_REMOVE_DELAY_MS);
        } catch {
          // Role may not be removable
        }
      }

      await roleMsg.edit(`⌨️ **Fase 2/3:** ✅ ${removedRoles} rol(es) deshecho(s).`);
    } else {
      await channel.send('⌨️ **Fase 2/3:** ✅ No hay roles que deshacer.');
    }

    // =========================================================================
    // Phase 3: "Undo server join" with progress counter
    // =========================================================================
    await delay(1000);
    const progressMsg = await channel.send(
      `⌨️ **Fase 3/3:** Deshaciendo la unión al servidor...\n${buildProgressBar(0, PROGRESS_STEPS)}`
    );

    for (let step = 1; step <= PROGRESS_STEPS; step++) {
      await delay(PROGRESS_STEP_DELAY_MS);
      await progressMsg
        .edit(
          `⌨️ **Fase 3/3:** Deshaciendo la unión al servidor...\n${buildProgressBar(step, PROGRESS_STEPS)}`
        )
        .catch(() => {});
    }

    await delay(500);

    // Execute ban
    const result = await executeCreativeBan(
      guild,
      target.user,
      moderator,
      'Ctrl+Z: acción deshecha',
      'ctrl-z'
    );

    if (result.success) {
      await progressMsg.edit(
        `⌨️ **Fase 3/3:** ✅ Unión al servidor deshecha. Caso #${result.caseNumber}.`
      );
      await delay(2000);
      await channel.send('🍃 *¿Ha dicho alguien algo? Ha debido de ser el viento...*');
    } else {
      await channel.send(`❌ Error al ejecutar el ban: ${result.error}`);
    }
  } catch (error) {
    container.logger.error('[creative-bans/ctrl-z] Error during execution:', error);

    // Emergency ban
    try {
      await executeCreativeBan(
        guild,
        target.user,
        moderator,
        'Ctrl+Z: acción deshecha (error en secuencia)',
        'ctrl-z'
      );
    } catch {
      // Last resort failed
    }

    await channel
      .send('❌ Error durante la secuencia. Se intentó ejecutar el ban igualmente.')
      .catch(() => {});
  }
}
