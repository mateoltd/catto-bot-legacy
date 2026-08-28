/**
 * Voice XP Session Service
 * Manages voice session lifecycle and XP awards
 */

import type { GuildVoiceXPConfig } from '@prisma/client';
import { MessageFlags, NewsChannel, TextChannel, type VoiceState } from 'discord.js';
import type { VoiceValidationContext, SessionAwardResult } from '../types/voice-xp.types.js';
import { VoiceXPMode } from '../types/voice-xp.types.js';
import * as sessionTracking from '../utils/session-tracking.js';
import * as validation from '../utils/validation.js';
import * as voiceSessionRepository from '../repositories/voice-session.repository.js';
import * as voiceXPRepository from '../repositories/voice-xp.repository.js';
import { calculateVoiceLevel } from './voice-level-calculator.service.js';
import { getVoiceXPConfig } from './voice-xp-config.service.js';
import { container } from '@sapphire/framework';
import { ReputationService } from '#modules/reputation/services/reputation.service.js';
import { container as fluentContainer } from '#root/lib/discord/containers/container.js';
import { parseVoiceTemplate } from '../utils/templates.js';
import type { VoiceTemplateVariables } from '../types/voice-xp.types.js';
import { RewardIntegration } from '#modules/rewards/integrations/RewardIntegration.js';
import type { RewardClaimResult } from '#lib/types/rewards.types.js';

export async function handleVoiceJoin(voiceState: VoiceState): Promise<void> {
  const { guild, member, channelId } = voiceState;
  if (!guild || !member || !channelId) return;

  const config = await getVoiceXPConfig(guild.id);
  if (!config.enabled) return;

  // Check if user is a bot
  if (member.user.bot) return;

  // Create database session
  const dbSession = await voiceSessionRepository.createVoiceSession(
    guild.id,
    member.id,
    channelId,
    (voiceState.mute ?? false) || (voiceState.selfMute ?? false),
    (voiceState.deaf ?? false) || (voiceState.selfDeaf ?? false),
    voiceState.streaming ?? false,
    voiceState.selfVideo ?? false
  );

  // Start in-memory session tracking
  await sessionTracking.startSession({
    guildId: guild.id,
    userId: member.id,
    channelId,
    joinedAt: Date.now(),
    sessionId: dbSession.id,
    isMuted: (voiceState.mute ?? false) || (voiceState.selfMute ?? false),
    isDeafened: (voiceState.deaf ?? false) || (voiceState.selfDeaf ?? false),
    isStreaming: voiceState.streaming ?? false,
    isVideo: voiceState.selfVideo ?? false,
    lastAwardTime: Date.now(),
  });

  container.logger.info(`[Voice XP] User ${member.user.tag} joined voice in guild ${guild.name}`);
}

export async function handleVoiceLeave(voiceState: VoiceState): Promise<SessionAwardResult | null> {
  const { guild, member } = voiceState;
  if (!guild || !member) return null;

  const config = await getVoiceXPConfig(guild.id);
  if (!config.enabled) return null;

  // End in-memory session
  const session = await sessionTracking.endSession(guild.id, member.id);
  if (!session) {
    container.logger.warn(`[Voice XP] No active session found for ${member.user.tag}`);
    return null;
  }

  const durationMinutes = Math.floor((Date.now() - session.joinedAt) / 60000);

  // Check minimum duration
  if (durationMinutes < config.minSessionMinutes) {
    await voiceSessionRepository.endVoiceSession(session.sessionId, durationMinutes, 0);
    container.logger.debug(
      `[Voice XP] Session too short: ${durationMinutes}m < ${config.minSessionMinutes}m`
    );
    return {
      awarded: false,
      reason: 'Session duration below minimum',
    };
  }

  // Validate XP award
  const context: VoiceValidationContext = {
    guildId: guild.id,
    userId: member.id,
    channelId: session.channelId,
    userRoles: member.roles.cache.map((r) => r.id),
    isMuted: session.isMuted,
    isDeafened: session.isDeafened,
    isStreaming: session.isStreaming,
    isVideo: session.isVideo,
    isAfkChannel: guild.afkChannelId === session.channelId,
  };

  const validationResult = validation.validateVoiceXPAward(context, config);
  if (!validationResult.valid) {
    await voiceSessionRepository.endVoiceSession(session.sessionId, durationMinutes, 0);
    container.logger.debug(`[Voice XP] Session not awarded: ${validationResult.reason}`);
    return {
      awarded: false,
      reason: validationResult.reason || 'Validation failed',
    };
  }

  // In PER_MINUTE mode, XP is awarded by the queue worker
  if (config.xpMode === VoiceXPMode.PER_MINUTE) {
    await voiceSessionRepository.endVoiceSession(session.sessionId, durationMinutes, 0);
    return {
      awarded: false,
      reason: 'Session ended in PER_MINUTE mode',
      durationMinutes,
    };
  }

  const reputationMultiplier = await getReputationMultiplier(guild.id, member.id);

  const antiFarmMultiplier = getAntiFarmMultiplier(
    config,
    guild,
    session.channelId,
    session.isMuted,
    session.isDeafened
  );

  // Calculate XP award with reputation and anti-farm multipliers
  const xpAwarded = validation.calculateSessionXP(
    durationMinutes,
    config.xpPerMinute,
    reputationMultiplier * antiFarmMultiplier
  );

  if (xpAwarded <= 0) {
    await voiceSessionRepository.endVoiceSession(session.sessionId, durationMinutes, 0);
    return {
      awarded: false,
      reason: 'Award amount was zero after dampening',
      durationMinutes,
    };
  }

  // Award XP
  const userXP = await voiceXPRepository.getUserVoiceXP(guild.id, member.id);
  const newTotalXP = (userXP?.xp ?? 0) + xpAwarded;
  const levelCalc = calculateVoiceLevel(config, newTotalXP);

  const result = await voiceXPRepository.awardVoiceXPSafe(
    guild.id,
    member.id,
    xpAwarded,
    levelCalc.level,
    durationMinutes,
    {
      channelId: session.channelId,
      channelName: guild.channels.cache.get(session.channelId)?.name,
      wasStreaming: session.isStreaming,
      wasVideo: session.isVideo,
      sessionId: session.sessionId,
    }
  );

  // Update database session
  await voiceSessionRepository.endVoiceSession(session.sessionId, durationMinutes, xpAwarded);

  container.logger.info(
    `[Voice XP] Awarded ${xpAwarded} XP to ${member.user.tag} for ${durationMinutes}m session (Level ${result.userXP.level})`
  );

  if (result.leveledUp) {
    await handleVoiceLevelUpEffects({
      guildId: guild.id,
      userId: member.id,
      newLevel: result.userXP.level,
      newXp: result.userXP.xp,
      xpGained: xpAwarded,
      durationMinutes,
    });
  }

  return {
    awarded: true,
    xpGained: xpAwarded,
    newXp: result.userXP.xp,
    newLevel: result.userXP.level,
    leveledUp: result.leveledUp,
    previousLevel: result.previousLevel,
    durationMinutes,
  };
}

export async function handleVoiceMove(
  oldState: VoiceState,
  newState: VoiceState
): Promise<SessionAwardResult | null> {
  // End old session and start new one
  const leaveResult = await handleVoiceLeave(oldState);
  await handleVoiceJoin(newState);
  return leaveResult;
}

export async function handleVoiceStateUpdate(
  _oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const { guild, member } = newState;
  if (!guild || !member) return;

  const session = await sessionTracking.getActiveSession(guild.id, member.id);
  if (!session) return;

  const newMuted = (newState.mute ?? false) || (newState.selfMute ?? false);
  const newDeafened = (newState.deaf ?? false) || (newState.selfDeaf ?? false);
  const newStreaming = newState.streaming ?? false;
  const newVideo = newState.selfVideo ?? false;

  // Check if state changed from invalid to valid (e.g., unmuted, undeafened)
  const wasInvalid = session.isMuted || session.isDeafened;
  const isNowValid = !newMuted && !newDeafened;

  // Update in-memory session state
  await sessionTracking.updateSession(guild.id, member.id, {
    isMuted: newMuted,
    isDeafened: newDeafened,
    isStreaming: newStreaming,
    isVideo: newVideo,
    // Reset lastAwardTime if user transitions from invalid to valid state
    ...(wasInvalid && isNowValid ? { lastAwardTime: Date.now() } : {}),
  });

  // Update database session state to track streaming/video
  try {
    await voiceSessionRepository.updateVoiceSessionState(session.sessionId, {
      wasStreaming: newStreaming || session.isStreaming, // Keep true if was ever streaming
      wasVideo: newVideo || session.isVideo, // Keep true if was ever on video
      wasMuted: newMuted,
      wasDeafened: newDeafened,
    });
  } catch (error) {
    container.logger.error('[Voice XP] Failed to update session state in database:', error);
  }

  if (wasInvalid && isNowValid) {
    container.logger.debug(
      `[Voice XP] User ${member.user.tag} became eligible for XP in ${guild.name} - resetting award timer`
    );
  }
}

function getAntiFarmMultiplier(
  config: GuildVoiceXPConfig,
  guild: VoiceState['guild'],
  channelId: string,
  isMuted: boolean,
  isDeafened: boolean
): number {
  if (!config.antiFarmDampeningEnabled) {
    return 1;
  }

  let multiplier = 1;
  const dampeningMultiplier = Math.min(Math.max(config.antiFarmDampeningMultiplier, 0), 1);

  if (isMuted || isDeafened) {
    multiplier = Math.min(multiplier, dampeningMultiplier);
  }

  const channel = guild.channels.cache.get(channelId);
  if (channel?.isVoiceBased()) {
    const nonBotParticipants = channel.members.filter((voiceMember) => !voiceMember.user.bot).size;
    if (nonBotParticipants < config.antiFarmMinimumParticipants) {
      multiplier = Math.min(multiplier, dampeningMultiplier);
    }
  }

  return multiplier;
}

async function getReputationMultiplier(guildId: string, userId: string): Promise<number> {
  let reputationMultiplier = 1.0;
  try {
    const reputationService = new ReputationService(container.prisma);
    const reputation = await reputationService.getOrCreateReputation(guildId, userId);
    reputationMultiplier = reputationService.getXPBoostForTier(reputation.reputationTier);
  } catch (error) {
    // If reputation system fails, continue with default multiplier
    container.logger.warn('Failed to get reputation multiplier for voice XP:', error);
  }
  return reputationMultiplier;
}

interface VoiceLevelUpContext {
  guildId: string;
  userId: string;
  newLevel: number;
  newXp: number;
  xpGained: number;
  durationMinutes: number;
}

export async function handleVoiceLevelUpEffects(context: VoiceLevelUpContext): Promise<void> {
  try {
    const guild = container.client.guilds.cache.get(context.guildId);
    if (!guild) return;

    const member = await guild.members.fetch(context.userId).catch(() => null);
    if (!member) return;

    let rewardResults: RewardClaimResult[] = [];
    rewardResults = await RewardIntegration.onVoiceLevelUp(
      guild.id,
      member.id,
      context.newLevel,
      context.newXp,
      guild,
      member
    );

    const config = await getVoiceXPConfig(guild.id);
    if (!config.announceLevelUp || !config.announceChannelId) {
      return;
    }

    const channel = guild.channels.cache.get(config.announceChannelId);
    if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
      return;
    }

    const levelCalc = calculateVoiceLevel(config, context.newXp);
    const template = config.messageTemplate || '🎤 {user} reached voice level {level}!';
    const variables: VoiceTemplateVariables = {
      user: `<@${member.id}>`,
      userId: member.id,
      username: member.user.username,
      level: context.newLevel,
      xpGain: context.xpGained,
      totalXp: context.newXp,
      minutesInVoice: context.durationMinutes,
      nextLevelXp: levelCalc.nextLevelXp,
      progress: levelCalc.progress,
      type: 'Voice',
    };

    let messageText = parseVoiceTemplate(template, variables);
    const rewardsSummary = RewardIntegration.formatRewardsSummary(rewardResults);
    if (rewardsSummary) {
      messageText += rewardsSummary;
    }

    if (config.embedEnabled) {
      const ui = fluentContainer({ color: config.embedColor })
        .h2('Voice XP Level Up')
        .text(messageText)
        .footerWithTimestamp();

      await channel.send({
        components: [ui.build()],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] },
      });
    } else {
      await channel.send(messageText);
    }
  } catch (error) {
    container.logger.error('[Voice XP] Failed to send level-up announcement:', error);
  }
}

export async function awardPerMinuteXP(guildId: string): Promise<number> {
  const config = await getVoiceXPConfig(guildId);
  if (!config.enabled || config.xpMode !== VoiceXPMode.PER_MINUTE) return 0;
  const guild = container.client.guilds.cache.get(guildId);
  if (!guild) return 0;

  const activeSessions = await sessionTracking.getGuildActiveSessions(guildId);

  if (activeSessions.length === 0) {
    container.logger.debug(`[Voice XP] No active sessions for guild ${guildId}`);
    return 0;
  }

  container.logger.debug(
    `[Voice XP] Processing ${activeSessions.length} active session(s) for guild ${guildId}`
  );
  let awarded = 0;

  for (const session of activeSessions) {
    const minutesSinceLastAward = Math.floor((Date.now() - session.lastAwardTime) / 60000);
    if (minutesSinceLastAward < 1) {
      container.logger.debug(
        `[Voice XP] Session ${session.userId} in guild ${guildId} not due yet (${minutesSinceLastAward}m since last award)`
      );
      continue;
    }

    // Fetch member for validation
    const member = await guild.members.fetch(session.userId).catch(() => null);
    if (!member) continue;

    // Validate XP award
    const context: VoiceValidationContext = {
      guildId: session.guildId,
      userId: session.userId,
      channelId: session.channelId,
      userRoles: member.roles.cache.map((r) => r.id),
      isMuted: session.isMuted,
      isDeafened: session.isDeafened,
      isStreaming: session.isStreaming,
      isVideo: session.isVideo,
      isAfkChannel: guild.afkChannelId === session.channelId,
    };

    const validationResult = validation.validateVoiceXPAward(context, config);
    if (!validationResult.valid) {
      container.logger.debug(
        `[Voice XP] Validation failed for ${session.userId}: ${validationResult.reason}`
      );
      continue;
    }

    const antiFarmMultiplier = getAntiFarmMultiplier(
      config,
      guild,
      session.channelId,
      session.isMuted,
      session.isDeafened
    );
    const reputationMultiplier = await getReputationMultiplier(guildId, session.userId);
    const xpAwarded = Math.floor(config.xpPerMinute * antiFarmMultiplier * reputationMultiplier);
    if (xpAwarded <= 0) {
      continue;
    }

    const userXP = await voiceXPRepository.getUserVoiceXP(guildId, session.userId);
    const newTotalXP = (userXP?.xp ?? 0) + xpAwarded;
    const levelCalc = calculateVoiceLevel(config, newTotalXP);

    const result = await voiceXPRepository.awardVoiceXPSafe(
      guildId,
      session.userId,
      xpAwarded,
      levelCalc.level,
      1, // 1 minute
      {
        channelId: session.channelId,
        channelName: guild.channels.cache.get(session.channelId)?.name,
        wasStreaming: session.isStreaming,
        wasVideo: session.isVideo,
        sessionId: session.sessionId,
      }
    );

    if (result.leveledUp) {
      await handleVoiceLevelUpEffects({
        guildId,
        userId: session.userId,
        newLevel: result.userXP.level,
        newXp: result.userXP.xp,
        xpGained: xpAwarded,
        durationMinutes: 1,
      });
    }

    await sessionTracking.updateSession(guildId, session.userId, {
      lastAwardTime: Date.now(),
    });
    awarded++;

    container.logger.debug(
      `[Voice XP] Awarded ${xpAwarded} XP to ${session.userId} in guild ${guildId} (x${antiFarmMultiplier.toFixed(2)})`
    );
  }

  if (awarded > 0) {
    container.logger.info(`[Voice XP] Awarded XP to ${awarded} user(s) in guild ${guildId}`);
  }

  return awarded;
}
