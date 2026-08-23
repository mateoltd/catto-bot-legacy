/**
 * Creative Ban: Eject (Among Us style)
 *
 * Target must be in a voice channel. Plays an Among Us-style "emergency meeting"
 * with audio in VC plus a cosmetic voting UI in text (outcome is predetermined),
 * then plays the ejection sound, ejects, and bans.
 *
 * If audio playback fails the text theater and ban still execute normally.
 */

import { container } from '@sapphire/framework';
import {
  type GuildMember,
  type Message,
  type TextChannel,
  type VoiceChannel,
  type StageChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { executeCreativeBan, delay } from './_shared.js';
import { joinVoice, disconnectVoice, playClip, startClip } from './_voice.js';
import type { VoiceConnection } from '@discordjs/voice';

const VOTING_DURATION_MS = 15_000;
const VOICE_SAFETY_TIMEOUT_MS = 45_000;
const EJECT_COLORS = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500];

/**
 * Get a random Among Us color.
 */
function getRandomColor(): number {
  return EJECT_COLORS[Math.floor(Math.random() * EJECT_COLORS.length)] ?? 0xff0000;
}

/**
 * Execute the eject creative ban sequence.
 */
export async function executeEject(message: Message, target: GuildMember): Promise<void> {
  const guild = message.guild!;
  const moderator = message.author;
  const channel = message.channel as TextChannel;

  // Check if target is in a voice channel
  const voiceChannel = target.voice.channel as VoiceChannel | StageChannel | null;
  if (!voiceChannel) {
    await channel.send('❌ El objetivo debe estar en un canal de voz para una expulsión.');
    return;
  }

  // Manage the voice connection manually — we need it across two audio moments
  // (emergency-meeting before voting, ejection after voting).
  let connection: VoiceConnection | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    // --- Join voice (best-effort) ---
    connection = await joinVoice(voiceChannel);

    if (connection) {
      // Safety timeout — hard disconnect after max duration
      safetyTimer = setTimeout(() => {
        container.logger.warn('[creative-bans/eject] Safety timeout reached, disconnecting');
        disconnectVoice(connection);
        connection = null;
      }, VOICE_SAFETY_TIMEOUT_MS);

      // Play emergency meeting sound
      await playClip(connection, 'emergency-meeting').catch(() => {});
    }

    // --- Emergency meeting announcement ---
    await channel.send('# 🚨 ¡¡¡REUNIÓN DE EMERGENCIA!!! 🚨');
    await delay(2000);

    const crewmateColor = getRandomColor();

    // Voting embed with buttons (cosmetic)
    const votingEmbed = new EmbedBuilder()
      .setColor(crewmateColor)
      .setTitle('🗳️ Votación de Emergencia')
      .setDescription(
        [
          `**Sospechoso:** ${target.user.tag}`,
          `**Reportado en:** ${voiceChannel.name}`,
          '',
          '¿Quién es el impostor?',
          '',
          `> 🔴 ${target.user.tag} — **SUS**`,
          '',
          '*La votación se cerrará automáticamente...*',
        ].join('\n')
      )
      .setThumbnail(target.displayAvatarURL())
      .setFooter({ text: 'Among Us • Votación en curso' });

    const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`eject:vote:${target.id}`)
        .setLabel('Expulsar')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId(`eject:skip:${target.id}`)
        .setLabel('Saltar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏭️')
    );

    const voteMsg = await channel.send({
      embeds: [votingEmbed],
      components: [voteRow],
    });

    // Play discussion music during voting (background — stopped when voting ends)
    let stopDiscussion: (() => void) | null = null;
    if (connection) {
      stopDiscussion = startClip(connection, 'discussion');
    }

    // Collect votes (cosmetic — outcome is predetermined)
    let ejectVotes = 1; // Starts at 1 (the moderator's implicit vote)
    let skipVotes = 0;

    const collector = voteMsg.createMessageComponentCollector({
      time: VOTING_DURATION_MS,
    });

    collector.on('collect', async (interaction) => {
      // Ignore interactions from the target — they don't get to vote
      if (interaction.user.id === target.id) {
        await interaction.reply({
          content: '❌ No puedes votar en tu propia expulsión.',
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId.startsWith('eject:vote:')) {
        ejectVotes++;
        await interaction.reply({
          content: `🗳️ Has votado por **expulsar**. (${ejectVotes} votos)`,
          ephemeral: true,
        });
      } else if (interaction.customId.startsWith('eject:skip:')) {
        skipVotes++;
        await interaction.reply({
          content: `⏭️ Has votado por **saltar**. (${skipVotes} votos)`,
          ephemeral: true,
        });
      }
    });

    // Wait for voting to end
    await delay(VOTING_DURATION_MS);
    collector.stop();

    // Disable buttons
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`eject:vote:done`)
        .setLabel(`Expulsar (${ejectVotes})`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`eject:skip:done`)
        .setLabel(`Saltar (${skipVotes})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await voteMsg.edit({ components: [disabledRow] }).catch(() => {});

    // Stop discussion music before ejection sequence
    if (stopDiscussion) stopDiscussion();

    // --- Ejection sequence ---
    await delay(1000);
    await channel.send(`\n\n\n\u200b`);
    await delay(500);

    // Play ejection sound in parallel with the dot sequence
    const ejectionPromise = connection
      ? playClip(connection, 'ejection').catch(() => {})
      : Promise.resolve();

    const ejectionSteps = ['.', '. .', '. . .', `. . . .`];

    for (const step of ejectionSteps) {
      await channel.send(`> ${step}`);
      await delay(800);
    }

    await ejectionPromise;

    // Disconnect from voice
    try {
      await target.voice.disconnect('Eject: voted out');
    } catch {
      // May not have permission
    }

    await delay(500);

    // Execute ban
    const result = await executeCreativeBan(
      guild,
      target.user,
      moderator,
      'Expulsado por votación de la tripulación',
      'eject'
    );

    if (result.success) {
      // Ejection result
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x000000)
            .setDescription(
              [
                `# ${target.user.tag} fue expulsado.`,
                '',
                `*${target.user.tag} era el Impostor.*`,
                '*0 Impostores quedan.*',
                '',
                `-# Caso #${result.caseNumber}`,
              ].join('\n')
            ),
        ],
      });
    } else {
      await channel.send(`❌ Error al ejecutar el ban: ${result.error}`);
    }
  } catch (error) {
    container.logger.error('[creative-bans/eject] Error during execution:', error);

    // Emergency ban
    try {
      await executeCreativeBan(
        guild,
        target.user,
        moderator,
        'Expulsado por votación de la tripulación (error en secuencia)',
        'eject'
      );
    } catch {
      // Last resort failed
    }

    await channel
      .send('❌ Error durante la secuencia. Se intentó ejecutar el ban igualmente.')
      .catch(() => {});
  } finally {
    // Always clean up voice
    if (safetyTimer) clearTimeout(safetyTimer);
    disconnectVoice(connection);
  }
}
