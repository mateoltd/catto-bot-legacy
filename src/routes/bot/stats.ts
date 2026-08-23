import { Route } from '@sapphire/plugin-api';
import { ApplyOptions } from '@sapphire/decorators';
import { getStats } from '#lib/database.js';

@ApplyOptions<Route.Options>({
  route: 'bot/stats',
})
export class BotStatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      methods: ['GET'],
    });
  }

  public async run(_request: Route.Request, response: Route.Response) {
    try {
      const { client } = this.container;

      // Get database stats
      const dbStats = await getStats();

      // Calculate uptime
      const uptimeSeconds = Math.floor((client.uptime ?? 0) / 1000);
      const uptimeMinutes = Math.floor(uptimeSeconds / 60);
      const uptimeHours = Math.floor(uptimeMinutes / 60);
      const uptimeDays = Math.floor(uptimeHours / 24);

      // Get memory usage
      const memoryUsage = process.memoryUsage();

      return response.json({
        bot: {
          username: client.user?.username,
          id: client.user?.id,
          avatar: client.user?.displayAvatarURL(),
          status: 'online',
        },
        guilds: {
          total: client.guilds.cache.size,
          database: dbStats.guilds,
        },
        users: {
          total: client.users.cache.size,
          database: dbStats.users,
        },
        channels: {
          total: client.channels.cache.size,
        },
        uptime: {
          milliseconds: client.uptime,
          seconds: uptimeSeconds,
          minutes: uptimeMinutes,
          hours: uptimeHours,
          days: uptimeDays,
          formatted: `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`,
        },
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          unit: 'MB',
        },
        ping: {
          ws: client.ws.ping,
        },
        logs: {
          total: dbStats.logs,
        },
      });
    } catch (error) {
      this.container.logger.error('Error fetching bot stats:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
