/**
 * Creative Ban: Quicksand
 *
 * Deletes the target's messages and re-posts them via webhook, progressively
 * degrading the content until they "sink" and get banned.
 */

import { container } from '@sapphire/framework';
import { type GuildMember, type Message, type TextChannel, type Webhook } from 'discord.js';
import { executeCreativeBan, delay } from './_shared.js';

const MAX_MESSAGES = 6;
const TIMEOUT_MS = 45_000; // 45 seconds max wait
const DEGRADATION_CHARS = ['_', '.', '~', '▓', '░'];

/**
 * Degrade a username progressively.
 * Each step replaces more characters with underscores from the end.
 */
function degradeUsername(original: string, step: number, totalSteps: number): string {
  const ratio = step / totalSteps;
  const charsToReplace = Math.floor(original.length * ratio);
  const kept = original.slice(0, original.length - charsToReplace);
  const replaced = '_'.repeat(charsToReplace);
  return kept + replaced || '_';
}

/**
 * Degrade message content progressively.
 * Words get truncated and garbled as the user "sinks."
 */
function degradeContent(original: string, step: number, totalSteps: number): string {
  const ratio = step / totalSteps;

  if (ratio >= 0.9) {
    return '...';
  }

  const words = original.split(' ');
  const visibleWordCount = Math.max(1, Math.floor(words.length * (1 - ratio)));
  const visibleWords = words.slice(0, visibleWordCount);

  return visibleWords
    .map((word, _i) => {
      // Randomly truncate characters from words
      const charsToKeep = Math.max(1, Math.floor(word.length * (1 - ratio * 0.7)));
      const truncated = word.slice(0, charsToKeep);
      // Add noise characters
      const noiseCount = Math.floor(ratio * 3);
      let noise = '';
      for (let j = 0; j < noiseCount; j++) {
        noise += DEGRADATION_CHARS[Math.floor(Math.random() * DEGRADATION_CHARS.length)] ?? '.';
      }
      return truncated + noise;
    })
    .join(' ');
}

/**
 * Execute the quicksand creative ban sequence.
 */
export async function executeQuicksand(message: Message, target: GuildMember): Promise<void> {
  const guild = message.guild!;
  const moderator = message.author;
  const channel = message.channel as TextChannel;

  let webhook: Webhook | null = null;
  let messageCount = 0;
  let collectorActive = true;

  try {
    await channel.send(`🏜️ El suelo bajo **${target.user.tag}** empieza a temblar...`);
    await delay(1500);

    // Create webhook for impersonation
    webhook = await channel.createWebhook({
      name: target.displayName,
      avatar: target.displayAvatarURL(),
      reason: 'Creative ban: quicksand',
    });

    // Set up a message collector
    const collector = channel.createMessageCollector({
      filter: (m) => m.author.id === target.id,
      time: TIMEOUT_MS,
    });

    const messagePromise = new Promise<void>((resolve) => {
      collector.on('collect', async (msg) => {
        if (!collectorActive || !webhook) return;
        messageCount++;
        const step = messageCount;

        try {
          // Delete original message
          await msg.delete().catch(() => {});

          // Re-post degraded version via webhook
          const degradedName = degradeUsername(target.displayName, step, MAX_MESSAGES);
          const degradedContent = degradeContent(msg.content || '...', step, MAX_MESSAGES);

          await webhook.send({
            content: degradedContent,
            username: degradedName,
            avatarURL: step <= MAX_MESSAGES / 2 ? target.displayAvatarURL() : undefined,
          });

          // Flavor messages
          if (step === 2) {
            await channel.send('-# *El suelo se vuelve blando...*');
          } else if (step === 4) {
            await channel.send('-# *Se está hundiendo...*');
          }
        } catch (error) {
          container.logger.warn('[creative-bans/quicksand] Error processing message:', error);
        }

        if (messageCount >= MAX_MESSAGES) {
          collectorActive = false;
          collector.stop('max_messages');
          resolve();
        }
      });

      collector.on('end', () => {
        resolve();
      });
    });

    await messagePromise;

    // Sink message
    if (webhook) {
      try {
        await webhook.send({
          content: '...',
          username: '___',
        });
      } catch {
        // Webhook may be gone
      }
    }

    await delay(1000);
    await channel.send('🕳️ *\\*glub glub glub\\**');
    await delay(1500);

    // Execute ban
    const result = await executeCreativeBan(
      guild,
      target.user,
      moderator,
      'Se hundió en arenas movedizas',
      'quicksand'
    );

    if (result.success) {
      await channel.send(
        `🏜️ **${target.user.tag}** se hundió en las arenas movedizas. No queda rastro. Caso #${result.caseNumber}.`
      );
    } else {
      await channel.send(`❌ Error al ejecutar el ban: ${result.error}`);
    }
  } catch (error) {
    container.logger.error('[creative-bans/quicksand] Error during execution:', error);

    // Emergency ban
    try {
      await executeCreativeBan(
        guild,
        target.user,
        moderator,
        'Se hundió en arenas movedizas (error en secuencia)',
        'quicksand'
      );
    } catch {
      // Last resort failed
    }

    await channel
      .send('❌ Error durante la secuencia. Se intentó ejecutar el ban igualmente.')
      .catch(() => {});
  } finally {
    // Cleanup: delete webhook
    collectorActive = false;
    if (webhook) {
      try {
        await webhook.delete('Cleanup: creative ban quicksand');
      } catch {
        // Webhook may already be deleted
      }
    }
  }
}
