/**
 * Creative Ban: Captcha
 *
 * Strips all roles from the target (hiding channels naturally), creates a
 * verification channel with an impossible captcha, gives them 3 attempts,
 * then bans on failure. No permission overrides are left behind.
 */

import { container } from '@sapphire/framework';
import {
  type GuildMember,
  type Message,
  type TextChannel,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import {
  executeCreativeBan,
  delay,
  safeDeleteChannel,
  zalgoify,
  generateCaptchaCode,
} from './_shared.js';

const CAPTCHA_CHANNEL_NAME = 'verificarse';
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 60_000; // 60s per attempt

/**
 * Execute the captcha creative ban sequence.
 */
export async function executeCaptcha(message: Message, target: GuildMember): Promise<void> {
  const guild = message.guild!;
  const moderator = message.author;
  const channel = message.channel as TextChannel;

  let verifyChannel: TextChannel | null = null;

  try {
    // Announce
    await channel.send(`🔒 Iniciando verificación de seguridad para **${target.user.tag}**...`);

    // Step 1: Strip all roles — channels hidden naturally via role permissions.
    // No per-channel overrides needed, no footprint left.
    const rolesToRemove = target.roles.cache.filter(
      (role) => role.id !== guild.id && role.editable
    );

    if (rolesToRemove.size > 0) {
      await target.roles.set([], 'Creative ban: captcha verification');
    }

    // Step 2: Create the verification channel
    verifyChannel = await guild.channels.create({
      name: CAPTCHA_CHANNEL_NAME,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: target.id,
          type: OverwriteType.Member,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: guild.members.me!.id,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    // Step 3: Generate the impossible captcha
    const captchaCode = generateCaptchaCode(8);
    const distortedCode = zalgoify(captchaCode, 5);

    const captchaEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚠️ Verificación de Seguridad Requerida')
      .setDescription(
        [
          'Se ha detectado actividad sospechosa en tu cuenta.',
          'Debes completar esta verificación para continuar.',
          '',
          '**Escribe el código que aparece a continuación:**',
          '',
          `\`\`\`${distortedCode}\`\`\``,
          '',
          `Tienes **${MAX_ATTEMPTS} intentos**. Escribe el código exactamente como aparece.`,
        ].join('\n')
      )
      .setFooter({ text: 'Sistema de Verificación Automático v3.14' });

    await verifyChannel.send({ embeds: [captchaEmbed] });

    // Step 4: Listen for attempts
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
      try {
        const collected = await verifyChannel.awaitMessages({
          filter: (m) => m.author.id === target.id,
          max: 1,
          time: ATTEMPT_TIMEOUT_MS,
        });

        const response = collected.first();
        if (!response) {
          // Timeout — count as failed attempt
          attempts++;
          if (attempts < MAX_ATTEMPTS) {
            await verifyChannel.send(
              `⏱️ Tiempo agotado. Te quedan **${MAX_ATTEMPTS - attempts}** intento(s).`
            );
          }
          continue;
        }

        attempts++;
        // The captcha is intentionally impossible — no response matches
        if (attempts < MAX_ATTEMPTS) {
          await verifyChannel.send(
            `❌ Código incorrecto. Te quedan **${MAX_ATTEMPTS - attempts}** intento(s).`
          );
        }
      } catch {
        // Collection error — count as failed
        attempts = MAX_ATTEMPTS;
      }
    }

    // Step 5: Verification failed — ban
    await verifyChannel.send(
      '❌ **VERIFICACIÓN FALLIDA**\n\nNo se ha podido verificar que eres humano.'
    );
    await delay(2000);

    const result = await executeCreativeBan(
      guild,
      target.user,
      moderator,
      'No se ha podido verificar que eres humano',
      'captcha'
    );

    if (result.success) {
      await channel.send(
        `🤖 **${target.user.tag}** no ha podido completar la verificación de seguridad. Caso #${result.caseNumber}.`
      );
    } else {
      await channel.send(`❌ Error al ejecutar el ban: ${result.error}`);
    }
  } catch (error) {
    container.logger.error('[creative-bans/captcha] Error during execution:', error);

    // Emergency ban — if the sequence failed, still try to ban
    try {
      await executeCreativeBan(
        guild,
        target.user,
        moderator,
        'No se ha podido verificar que eres humano (error en secuencia)',
        'captcha'
      );
    } catch {
      // Last resort failed
    }

    await channel
      .send('❌ Error durante la secuencia de verificación. Se intentó ejecutar el ban igualmente.')
      .catch(() => {});
  } finally {
    // Cleanup: delete verification channel (the only artifact we created)
    if (verifyChannel) {
      await delay(3000);
      await safeDeleteChannel(verifyChannel);
    }
    // No permission overrides to restore — roles were stripped and the ban
    // removes the user entirely. Zero footprint.
  }
}
