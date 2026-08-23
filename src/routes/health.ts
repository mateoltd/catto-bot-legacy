import { Route } from '@sapphire/plugin-api';
import { CONFIG } from '#config.js';

export class HealthRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'health',
      methods: ['GET'],
    });
  }

  public async run(_request: Route.Request, response: Route.Response) {
    const { client, redis, prisma } = this.container;

    let redisStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch {
      // leave as disconnected
    }

    let postgresStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      postgresStatus = 'connected';
    } catch {
      // leave as disconnected
    }

    const healthy = redisStatus === 'connected' && postgresStatus === 'connected';

    return response.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      version: CONFIG.DEPLOY_VERSION,
      guilds: client.guilds.cache.size,
      gateway: client.ws.status,
      redis: redisStatus,
      postgres: postgresStatus,
      timestamp: Date.now(),
    });
  }
}
