import { Route } from '@sapphire/plugin-api';

export class StatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'stats',
      methods: ['GET'],
    });
  }

  public run(_request: Route.Request, response: Route.Response) {
    const { client } = this.container;

    return response.json({
      guilds: client.guilds.cache.size,
      users: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
      channels: client.channels.cache.size,
      uptime: client.uptime ?? 0,
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      ping: Math.round(client.ws.ping),
    });
  }
}
