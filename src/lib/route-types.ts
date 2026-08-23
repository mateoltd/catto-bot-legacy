/**
 * Type extensions for Route API
 */

import type { Route } from '@sapphire/plugin-api';

export interface RouteRequestWithBody extends Route.Request {
  body?: unknown;
}
