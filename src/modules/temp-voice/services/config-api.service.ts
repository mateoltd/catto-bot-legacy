/**
 * Static service wrapper for TempVoiceConfigService
 * Provides static methods for API route usage
 */

import { container } from '@sapphire/framework';
import { TempVoiceConfigService } from './config.service.js';
import {
  mapApiInputToCreateData,
  mapApiInputToUpdateData,
  mapConfigToApiResponse,
  type TempVoiceConfigApiInput,
} from './config-api.mapper.js';

const configService = new TempVoiceConfigService(container.prisma, container.client);

/**
 * Static wrapper for temp voice configuration operations
 */
export class TempVoiceConfigServiceStatic {
  /**
   * Get configuration for a guild (returns null if not found)
   */
  static async getConfig(guildId: string) {
    const config = await configService.getOrNull(guildId);

    if (!config) {
      return null;
    }

    return mapConfigToApiResponse(config);
  }

  /**
   * Create configuration for a guild
   */
  static async createConfig(guildId: string, data: TempVoiceConfigApiInput) {
    // Map API input to service input
    const serviceData = mapApiInputToCreateData(data);

    const config = await configService.create(guildId, serviceData);

    return mapConfigToApiResponse(config);
  }

  /**
   * Update configuration for a guild
   */
  static async updateConfig(guildId: string, data: Partial<TempVoiceConfigApiInput>) {
    // Map API input to service input
    const serviceData = mapApiInputToUpdateData(data);

    const config = await configService.update(guildId, serviceData);

    return mapConfigToApiResponse(config);
  }

  /**
   * Delete configuration for a guild
   */
  static async deleteConfig(guildId: string): Promise<void> {
    await configService.delete(guildId);
  }

  /**
   * Add a join-to-create channel
   */
  static async addJoinChannel(guildId: string, channelId: string) {
    const joinChannels = await configService.addJoinChannel(guildId, channelId);
    const config = await configService.getOrNull(guildId);

    return {
      joinChannelIds: joinChannels,
      ...config,
    };
  }

  /**
   * Remove a join-to-create channel
   */
  static async removeJoinChannel(guildId: string, channelId: string) {
    const joinChannels = await configService.removeJoinChannel(guildId, channelId);
    const config = await configService.getOrNull(guildId);

    return {
      joinChannelIds: joinChannels,
      ...config,
    };
  }
}
