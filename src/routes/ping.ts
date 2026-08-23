import { Route } from '@sapphire/plugin-api';

export class PingRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'ping',
      methods: ['GET', 'POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { client } = this.container;
    const method = request.method;

    if (method === 'POST') {
      const body = (await request.readBodyJson()) as { message?: string };
      return response.json({
        echo: body?.message ?? 'No message provided',
        ping: Math.round(client.ws.ping),
        timestamp: Date.now(),
      });
    }

    return response.json({
      message: 'Pong!',
      ping: Math.round(client.ws.ping),
      timestamp: Date.now(),
    });
  }
}
