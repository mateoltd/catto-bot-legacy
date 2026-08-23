/**
 * Voice Session Repository
 */

import { container } from '@sapphire/framework';
import type { VoiceSession } from '@prisma/client';

export async function createVoiceSession(
  guildId: string,
  userId: string,
  channelId: string,
  isMuted: boolean,
  isDeafened: boolean,
  isStreaming: boolean,
  isVideo: boolean
): Promise<VoiceSession> {
  return await container.prisma.voiceSession.create({
    data: {
      guildId,
      userId,
      channelId,
      wasMuted: isMuted,
      wasDeafened: isDeafened,
      wasStreaming: isStreaming,
      wasVideo: isVideo,
    },
  });
}

export async function endVoiceSession(
  sessionId: string,
  durationMinutes: number,
  xpAwarded: number
): Promise<VoiceSession> {
  return await container.prisma.voiceSession.update({
    where: { id: sessionId },
    data: {
      leftAt: new Date(),
      durationMinutes,
      xpAwarded,
    },
  });
}

export async function updateVoiceSessionState(
  sessionId: string,
  updates: {
    wasStreaming?: boolean;
    wasVideo?: boolean;
    wasMuted?: boolean;
    wasDeafened?: boolean;
  }
): Promise<VoiceSession> {
  return await container.prisma.voiceSession.update({
    where: { id: sessionId },
    data: updates,
  });
}

export async function getActiveVoiceSession(
  guildId: string,
  userId: string
): Promise<VoiceSession | null> {
  return await container.prisma.voiceSession.findFirst({
    where: {
      guildId,
      userId,
      leftAt: null,
    },
    orderBy: { joinedAt: 'desc' },
  });
}

export async function getUserVoiceSessions(
  guildId: string,
  userId: string,
  limit: number = 10
): Promise<VoiceSession[]> {
  return await container.prisma.voiceSession.findMany({
    where: {
      guildId,
      userId,
      leftAt: { not: null },
    },
    orderBy: { joinedAt: 'desc' },
    take: limit,
  });
}
