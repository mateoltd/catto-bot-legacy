import { Listener, container } from '@sapphire/framework';
import { Events } from 'discord.js';
import {
  handleEmbeddedActivityUpdate,
  type RawEmbeddedActivityUpdate,
} from '#root/modules/voice/services/embeddedActivity.js';

/**
 * Raw gateway packet structure for undocumented events.
 * Discord.js types don't include EMBEDDED_ACTIVITY_UPDATE_V2,
 * so we define our own interface.
 */
interface RawGatewayPacket {
  t: string | null;
  d: unknown;
  s: number | null;
  op: number;
}

/**
 * Listener for raw gateway events to catch EMBEDDED_ACTIVITY_UPDATE_V2.
 *
 * Discord.js doesn't expose this event natively, so we intercept raw gateway
 * dispatch events and handle it manually.
 *
 * This event fires when:
 * - An embedded activity (Watch Together, Poker Night, etc.) starts in a voice channel
 * - Users join or leave an active embedded activity
 * - An embedded activity ends
 *
 * Requires the GUILD_EMBEDDED_ACTIVITIES intent (1 << 17 = 131072).
 */
export class EmbeddedActivityUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.Raw,
    });
  }

  public async run(packet: RawGatewayPacket) {
    // Check for the embedded activity update event
    // Discord uses EMBEDDED_ACTIVITY_UPDATE or EMBEDDED_ACTIVITY_UPDATE_V2
    if (packet.t !== 'EMBEDDED_ACTIVITY_UPDATE' && packet.t !== 'EMBEDDED_ACTIVITY_UPDATE_V2') {
      return;
    }

    container.logger.debug('[EmbeddedActivity] Received event:', packet.t);
    container.logger.debug('[EmbeddedActivity] Payload:', JSON.stringify(packet.d, null, 2));

    try {
      // The payload structure from the gateway
      const data = packet.d as RawEmbeddedActivityUpdate;

      await handleEmbeddedActivityUpdate(data);
    } catch (error) {
      container.logger.error('[EmbeddedActivity] Error processing event:', error);
    }
  }
}
