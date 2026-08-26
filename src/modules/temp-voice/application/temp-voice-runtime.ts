import { container } from "@sapphire/framework";

import { SystemTempVoiceClock } from "../ports/temp-voice-clock.port.js";
import type { TempVoiceTransport } from "../ports/temp-voice-transport.port.js";
import { PrismaTempVoiceRepository } from "../infrastructure/prisma-temp-voice.repository.js";
import { BullTempVoiceTransport } from "../infrastructure/bull-temp-voice.transport.js";
import { TempVoiceDiscordProjector } from "../infrastructure/temp-voice-discord.projector.js";
import { RedisTempVoiceLeaseRunner } from "../infrastructure/redis-aggregate-lease.js";
import { TempVoiceConfigService } from "../services/config.service.js";
import { UserPreferencesService } from "../services/user-preferences.service.js";
import { TempVoiceCoordinator } from "./temp-voice-coordinator.js";

let transport: TempVoiceTransport | null = null;

export function getTempVoiceTransport(): TempVoiceTransport {
  if (transport) return transport;

  const repository = new PrismaTempVoiceRepository(container.prisma);
  const clock = new SystemTempVoiceClock();
  const configService = new TempVoiceConfigService(
    container.prisma,
    container.client,
  );
  const preferences = new UserPreferencesService(container.prisma);
  const projector = new TempVoiceDiscordProjector(
    container.client,
    container.prisma,
  );
  const leases = new RedisTempVoiceLeaseRunner();
  const coordinator = new TempVoiceCoordinator(
    container.prisma,
    repository,
    clock,
    configService,
    preferences,
    projector,
    leases,
  );
  transport = new BullTempVoiceTransport(
    container.prisma,
    repository,
    coordinator,
  );
  return transport;
}

export async function shutdownTempVoiceTransport(): Promise<void> {
  if (!transport) return;
  const current = transport;
  transport = null;
  await current.shutdown();
}
