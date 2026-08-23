/**
 * Voice XP Ready Listener
 * Initializes voice sessions for users already in voice channels on bot startup
 */

import { Listener } from '@sapphire/framework';
import { Events } from 'discord.js';
import { handleVoiceJoin } from '../../modules/xp/xp-voice/services/voice-xp-session.service.js';
import { getActiveSession } from '../../modules/xp/xp-voice/utils/session-tracking.js';
import { getVoiceXPConfig } from '../../modules/xp/xp-voice/services/voice-xp-config.service.js';
import { voiceXPQueue } from '../../modules/xp/xp-voice/services/voice-xp-queue.service.js';

export class VoiceXPReadyListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      name: 'voiceXPReady',
      event: Events.ClientReady,
      once: true,
    });
  }

  public async run(): Promise<void> {
    this.container.logger.info('[Voice XP] Initializing voice sessions for existing users...');

    let totalSessions = 0;
    let guildsProcessed = 0;

    try {
      // Iterate through all guilds
      for (const [, guild] of this.container.client.guilds.cache) {
        try {
          // Check if voice XP is enabled for this guild
          const config = await getVoiceXPConfig(guild.id);
          if (!config.enabled) {
            continue;
          }

          let guildSessions = 0;

          // Iterate through all voice channels in the guild
          for (const [, channel] of guild.channels.cache) {
            if (!channel.isVoiceBased()) continue;

            // Iterate through all members in the voice channel
            for (const [, member] of channel.members) {
              // Skip bots
              if (member.user.bot) continue;

              // Check if user already has an active session
              const existingSession = await getActiveSession(guild.id, member.id);
              if (existingSession) {
                this.container.logger.debug(
                  `[Voice XP] User ${member.user.tag} already has active session in ${guild.name}`
                );
                continue;
              }

              // Create voice state object for handleVoiceJoin
              const voiceState = member.voice;
              if (voiceState && voiceState.channelId) {
                await handleVoiceJoin(voiceState);
                guildSessions++;
                totalSessions++;

                this.container.logger.debug(
                  `[Voice XP] Created session for ${member.user.tag} in ${guild.name}`
                );
              }
            }
          }

          if (guildSessions > 0) {
            this.container.logger.info(
              `[Voice XP] Created ${guildSessions} session(s) in ${guild.name}`
            );
          }

          guildsProcessed++;
        } catch (error) {
          this.container.logger.error(
            `[Voice XP] Error initializing voice sessions for guild ${guild.name}:`,
            error
          );
        }
      }

      this.container.logger.info(
        `[Voice XP] Initialization complete: ${totalSessions} session(s) created across ${guildsProcessed} guild(s)`
      );

      // Initialize BullMQ jobs for per-minute XP awards
      await voiceXPQueue.initializeAllGuilds();
    } catch (error) {
      this.container.logger.error('[Voice XP] Error during voice session initialization:', error);
    }
  }
}
