import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { ModEventChannels } from '#lib/redis.js';

/**
 * SSE endpoint for real-time moderation events.
 *
 * GET /api/guilds/{guildId}/moderation/events
 *
 * Streams events like evidence:created, case:updated, etc.
 * Uses Redis pub/sub to receive events published by backend services.
 */
export class ModEventsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/events',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;
    if (!guildId) {
      return response.status(400).json({ error: 'Guild ID is required' });
    }

    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate) {
      return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
    }

    const auth = await gate.checkAuth('mod.cases.view');
    if (!auth.ok) {
      return response.status(403).json({ error: 'Forbidden', code: auth.code });
    }

    // Set SSE headers
    // ApiResponse extends ServerResponse and ApiRequest extends IncomingMessage,
    // so Node.js stream methods are available directly — no need for .raw access.
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Write initial comment to establish connection
    response.write(': connected\n\n');

    // Create a dedicated Redis subscriber
    let subscriber: ReturnType<typeof this.container.redis.duplicate> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (subscriber) {
        subscriber.unsubscribe().catch(() => {});
        subscriber.quit().catch(() => {});
        subscriber = null;
      }
    };

    try {
      subscriber = this.container.redis.duplicate();
      const channel = ModEventChannels.MOD_EVENTS(guildId);

      // Explicitly connect and wait — the parent has lazyConnect: true
      // and enableOfflineQueue: false, so we must be connected before subscribing.
      await subscriber.connect();
      await subscriber.subscribe(channel);

      subscriber.on('message', (_ch: string, message: string) => {
        if (closed) return;
        try {
          response.write(`data: ${message}\n\n`);
        } catch {
          cleanup();
        }
      });

      // 30s heartbeat
      heartbeatTimer = setInterval(() => {
        if (closed) return;
        try {
          response.write(': heartbeat\n\n');
        } catch {
          cleanup();
        }
      }, 30_000);

      // Cleanup on client disconnect
      request.on('close', cleanup);
      request.on('error', cleanup);
    } catch (error) {
      cleanup();
      this.container.logger.error('Error in SSE route:', error);
      // If headers already sent, just close
      if (response.headersSent) {
        response.end();
      } else {
        return response.status(500).json({ error: 'Failed to establish SSE connection' });
      }
    }
  }
}
