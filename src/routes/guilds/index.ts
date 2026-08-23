import { Route } from '@sapphire/plugin-api';

export class GuildsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds',
      methods: ['GET'],
    });
  }

  public run(_request: Route.Request, response: Route.Response) {
    const { client } = this.container;

    const guilds = client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      createdAt: guild.createdTimestamp,
    }));

    return response.json({
      total: guilds.length,
      guilds,
    });
  }
}
