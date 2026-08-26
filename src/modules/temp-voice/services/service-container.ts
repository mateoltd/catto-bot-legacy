/**
 * Lazy singleton container for temp voice services.
 * Eliminates re-instantiation on every job/interaction.
 */

import { container } from "@sapphire/framework";
import { TempVoiceConfigService } from "./config.service.js";
import { TempChannelService } from "./temp-channel.service.js";
import { ChannelOperationsService } from "./operations.service.js";

export interface TempVoiceServices {
  config: TempVoiceConfigService;
  channels: TempChannelService;
  operations: ChannelOperationsService;
}

let _instance: TempVoiceServices | null = null;

/**
 * Get the shared temp voice services singleton.
 * Lazily initializes on first call (container.prisma/client must be ready).
 */
export function getTempVoiceServices(): TempVoiceServices {
  if (!_instance) {
    const config = new TempVoiceConfigService(
      container.prisma,
      container.client,
    );
    const channels = new TempChannelService(container.prisma);
    const operations = new ChannelOperationsService(channels, config);

    _instance = { config, channels, operations };
  }

  return _instance;
}
