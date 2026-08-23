/**
 * Creative Ban: Missile Strike
 *
 * Target must be in a voice channel. The bot performs a theatrical "missile strike"
 * with text-channel messages and voice-channel audio. It initializes a swarm of
 * auxiliary bot instances, launches missile fly-bys one by one, then triggers the
 * final explosion before banning the target.
 *
 * If audio playback fails for any reason the text theater and ban still execute.
 */

import { container } from '@sapphire/framework';
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type GuildMember,
  type Message,
  type TextChannel,
  type VoiceChannel,
  type StageChannel,
  type GuildBasedChannel,
  EmbedBuilder,
} from 'discord.js';
import { executeCreativeBan, delay } from './_shared.js';
import { joinVoice, disconnectVoice, playClip, startClip } from './_voice.js';
import type { VoiceConnection } from '@discordjs/voice';

const SWARM_INIT_WARNING_MS = 10_000;
const SWARM_READY_TIMEOUT_MS = 12_000;
const VOICE_SAFETY_TIMEOUT_MS = 90_000;
const POST_TARGET_LOCK_DELAY_MS = 2_000;
const MISSILE_FLY_DURATION_MS = 4_800;
const MISSILE_JOIN_BEFORE_END_MS = 1_000;
const NEXT_MISSILE_JOIN_DELAY_MS = Math.max(
  500,
  MISSILE_FLY_DURATION_MS - MISSILE_JOIN_BEFORE_END_MS
);
const BAN_AFTER_BOOM_START_MS = 1_500;
const SILO_CALLSIGNS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];

interface SwarmClient {
  client: Client;
  callsign: string;
}

function getMissileSwarmTokens(): string[] {
  const inlineTokens = (process.env.MISSILE_SWARM_TOKENS ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const indexedTokens = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('MISSILE_SWARM_TOKEN_') && typeof value === 'string')
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, value]) => value?.trim() ?? '')
    .filter((token) => token.length > 0);

  return [...new Set([...inlineTokens, ...indexedTokens])];
}

function isMissileStrikeEnabled(tokenCount: number): boolean {
  return tokenCount > 0;
}

function waitForClientReady(client: Client, timeoutMs: number): Promise<void> {
  if (client.isReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for swarm client ready state.'));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      client.off('ready', onReady);
      client.off('error', onError);
    };

    client.once('ready', onReady);
    client.once('error', onError);
  });
}

async function createSwarmClient(token: string, index: number): Promise<SwarmClient | null> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    presence: { status: 'invisible' },
  });

  try {
    await client.login(token);
    await waitForClientReady(client, SWARM_READY_TIMEOUT_MS);
    await client.user?.setPresence({ status: 'invisible' });

    return {
      client,
      callsign: SILO_CALLSIGNS[index] ?? `UNIT-${index + 1}`,
    };
  } catch (error) {
    container.logger.warn(
      '[creative-bans/missile-strike] Failed to initialize swarm client:',
      error
    );
    client.destroy();
    return null;
  }
}

async function initializeSwarm(tokens: string[]): Promise<SwarmClient[]> {
  const spawned = await Promise.all(tokens.map((token, index) => createSwarmClient(token, index)));
  return spawned.filter((entry): entry is SwarmClient => entry !== null);
}

function destroySwarm(swarm: SwarmClient[]): void {
  for (const entry of swarm) {
    try {
      entry.client.destroy();
    } catch {
      // Ignore teardown issues
    }
  }
}

async function resolveSwarmVoiceChannel(
  client: Client,
  sourceChannel: VoiceChannel | StageChannel
): Promise<VoiceChannel | StageChannel | null> {
  const guild = await client.guilds.fetch(sourceChannel.guild.id).catch(() => null);
  if (!guild) return null;

  const fetched = (await guild.channels
    .fetch(sourceChannel.id)
    .catch(() => null)) as GuildBasedChannel | null;
  if (!fetched) return null;

  if (fetched.type !== ChannelType.GuildVoice && fetched.type !== ChannelType.GuildStageVoice) {
    return null;
  }

  return fetched as VoiceChannel | StageChannel;
}

async function startMissileLaunchFromSwarmBot(
  swarmClient: SwarmClient,
  sourceChannel: VoiceChannel | StageChannel,
  groupBase: string
): Promise<{ connection: VoiceConnection; playback: Promise<boolean> } | null> {
  const voiceChannel = await resolveSwarmVoiceChannel(swarmClient.client, sourceChannel);
  if (!voiceChannel) {
    container.logger.warn(
      `[creative-bans/missile-strike] ${swarmClient.callsign} cannot access target voice channel.`
    );
    return null;
  }

  const groupSuffix = swarmClient.client.user?.id ?? swarmClient.callsign.toLowerCase();
  const connection = await joinVoice(voiceChannel, { group: `${groupBase}-${groupSuffix}` });
  if (!connection) return null;

  const playback = playClip(connection, 'missile-fly').catch(() => false);
  return { connection, playback };
}

/**
 * Execute the missile-strike creative ban sequence.
 */
export async function executeMissileStrike(message: Message, target: GuildMember): Promise<void> {
  const guild = message.guild!;
  const moderator = message.author;
  const channel = message.channel as TextChannel;

  // Check if target is in a voice channel
  const voiceChannel = target.voice.channel as VoiceChannel | StageChannel | null;
  if (!voiceChannel) {
    await channel.send('❌ El objetivo debe estar en un canal de voz para un ataque con misiles.');
    return;
  }

  const swarmTokens = getMissileSwarmTokens();
  if (!isMissileStrikeEnabled(swarmTokens.length)) {
    await channel.send('❌ Missile swarm deshabilitado: no hay instancias configuradas.');
    return;
  }
  const voiceGroupBase = `missile-${message.id}`;

  let commandConnection: VoiceConnection | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  let swarm: SwarmClient[] = [];
  const activeSwarmConnections: VoiceConnection[] = [];

  try {
    // Initial alert embed
    const alertEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🚨 ALERTA DE ATAQUE AÉREO 🚨')
      .setDescription(
        [
          `**Objetivo:** ${target.user.tag}`,
          `**Ubicación:** ${voiceChannel.name}`,
          `**Estado:** Inicializando enjambre`,
          '',
          '```diff',
          '- ALARMA ANTIAÉREA ACTIVADA',
          '- ENJAMBRE EN PREPARACIÓN',
          '```',
        ].join('\n')
      )
      .setFooter({ text: 'Comando Militar Catto • División de Artillería' });

    await channel.send({ embeds: [alertEmbed] });

    commandConnection = await joinVoice(voiceChannel, { group: `${voiceGroupBase}-main` });
    if (commandConnection) {
      safetyTimer = setTimeout(() => {
        container.logger.warn(
          '[creative-bans/missile-strike] Safety timeout reached, disconnecting'
        );
        disconnectVoice(commandConnection);
        commandConnection = null;
      }, VOICE_SAFETY_TIMEOUT_MS);
    }

    await channel.send(
      '🚨 **[ALARM]** Sirena antimisiles activa. Inicializando enjambre durante la alerta...'
    );

    const stopAlarm = commandConnection ? startClip(commandConnection, 'air-raid') : null;
    const [initializedSwarm] = await Promise.all([
      initializeSwarm(swarmTokens),
      delay(SWARM_INIT_WARNING_MS),
    ]);
    if (stopAlarm) stopAlarm();

    swarm = initializedSwarm;

    await channel.send(
      '🎯 **[TARGET LOCK]** Objetivo fijado. Preparando secuencia de lanzamiento...'
    );
    if (commandConnection) {
      await playClip(commandConnection, 'target-locked').catch(() => false);
    }

    await delay(POST_TARGET_LOCK_DELAY_MS);

    if (swarm.length === 0) {
      await channel.send('⚠️ No se pudo inicializar el enjambre. Ejecutando impacto directo.');
    } else {
      await channel.send('🛰️ **[SWARM]** Enjambre desplegado. Iniciando lanzamiento solapado...');
    }

    await Promise.all(
      swarm.map(async (swarmClient, index) => {
        if (index > 0) {
          await delay(index * NEXT_MISSILE_JOIN_DELAY_MS);
        }

        await channel.send(`🚀 **[SILO ${swarmClient.callsign}]** Misil lanzado.`);

        const launch = await startMissileLaunchFromSwarmBot(
          swarmClient,
          voiceChannel,
          voiceGroupBase
        );
        if (!launch) return;

        activeSwarmConnections.push(launch.connection);
        await launch.playback;
      })
    );

    await channel.send('⚠️ **IMPACTO INMINENTE**');

    const boomPromise = commandConnection
      ? playClip(commandConnection, 'explosion').catch(() => false)
      : Promise.resolve(false);
    await channel.send('💥💥💥 **¡¡¡BOOM!!!** 💥💥💥');

    for (const connection of activeSwarmConnections) {
      disconnectVoice(connection);
    }

    await delay(BAN_AFTER_BOOM_START_MS);

    try {
      await target.voice.disconnect('Missile strike: impacto directo');
    } catch {
      // May not have permission to disconnect
    }

    const result = await executeCreativeBan(
      guild,
      target.user,
      moderator,
      'Eliminado por ataque con misiles',
      'missile-strike'
    );

    if (result.success) {
      // Aftermath embed
      const aftermathEmbed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle('💀 Informe Post-Ataque')
        .setDescription(
          [
            `**Objetivo:** ${target.user.tag}`,
            `**Estado:** ☠️ Eliminado`,
            `**Zona de impacto:** ${voiceChannel.name}`,
            `**Caso:** #${result.caseNumber}`,
            '',
            '*No se detectan supervivientes en la zona.*',
          ].join('\n')
        )
        .setFooter({ text: 'Daños colaterales: 0 • Misión completada' });

      await channel.send({ embeds: [aftermathEmbed] });
    } else {
      await channel.send(`❌ Los misiles fallaron: ${result.error}`);
    }

    await boomPromise;
  } catch (error) {
    container.logger.error('[creative-bans/missile-strike] Error during execution:', error);

    // Emergency ban
    try {
      await executeCreativeBan(
        guild,
        target.user,
        moderator,
        'Eliminado por ataque con misiles (error en secuencia)',
        'missile-strike'
      );
    } catch {
      // Last resort failed
    }

    await channel
      .send('❌ Error durante el ataque. Se intentó ejecutar el ban igualmente.')
      .catch(() => {});
  } finally {
    if (safetyTimer) clearTimeout(safetyTimer);
    for (const connection of activeSwarmConnections) {
      disconnectVoice(connection);
    }
    disconnectVoice(commandConnection);
    destroySwarm(swarm);
  }
}
