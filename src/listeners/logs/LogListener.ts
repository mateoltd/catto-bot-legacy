import { container, Listener, type ListenerOptions } from '@sapphire/framework';
import type { ClientEvents } from 'discord.js';

/**
 * Base class for log listeners that automatically checks if a channel should be ignored
 * before logging events.
 */
export abstract class LogListener<E extends keyof ClientEvents> extends Listener<E> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, options);
  }

  /**
   * Check if logging should be skipped for a specific channel
   * @param guildId The guild ID
   * @param channelId The channel ID to check
   * @returns true if the channel should be ignored, false otherwise
   */
  protected async shouldIgnoreChannel(guildId: string, channelId?: string): Promise<boolean> {
    if (!channelId) return false;

    try {
      const config = await container.prisma.logConfig.findUnique({
        where: { guildId },
        select: { ignoredChannels: true, enabled: true },
      });

      // If logging is disabled, skip
      if (!config || !config.enabled) return true;

      // Check if channel is in ignored list
      return config.ignoredChannels.includes(channelId);
    } catch (error) {
      // If there's an error checking, don't block logging
      container.logger.error('Error checking ignored channels:', error);
      return false;
    }
  }
}
