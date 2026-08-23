/**
 * Test helpers for route testing
 */

import type { Route } from '@sapphire/plugin-api';

/**
 * Create a mock Route.Request object
 */
export function createMockRequest(options: {
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
  url?: string;
  query?: Record<string, string>;
}): Route.Request {
  return {
    method: options.method || 'GET',
    params: options.params || {},
    body: options.body,
    url: options.url || 'http://localhost/test',
    headers: {},
    query: options.query || {},
  } as unknown as Route.Request;
}

/**
 * Create a mock Route.Response object
 */
export function createMockResponse(): MockResponse {
  const mock: any = {
    statusCode: 200,
    data: null,
    headers: {},

    status(code: number) {
      mock.statusCode = code;
      return mock;
    },

    json(data: unknown) {
      mock.data = data;
      return mock;
    },

    setHeader(key: string, value: string) {
      mock.headers[key] = value;
      return mock;
    },

    badRequest(data?: unknown) {
      mock.statusCode = 400;
      mock.data = data || { error: 'Bad Request' };
      return mock;
    },
  };

  return mock as MockResponse;
}

export interface MockResponse {
  statusCode: number;
  data: unknown;
  headers: Record<string, string>;
  status(code: number): MockResponse;
  json(data: unknown): MockResponse;
  setHeader(key: string, value: string): MockResponse;
  badRequest(data?: unknown): MockResponse;
}

/**
 * Create a mock container for Sapphire routes
 */
export function createMockContainer(overrides?: {
  client?: {
    guilds?: {
      cache?: Map<string, any>;
    };
  };
  logger?: {
    info?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  };
}): any {
  const defaultGuilds = new Map([
    ['123456789', { id: '123456789', name: 'Test Guild' }],
  ]);

  return {
    client: {
      guilds: {
        cache: overrides?.client?.guilds?.cache || defaultGuilds,
      },
      ...overrides?.client,
    },
    logger: {
      info: overrides?.logger?.info || ((..._args: unknown[]) => {}),
      error: overrides?.logger?.error || ((..._args: unknown[]) => {}),
      debug: overrides?.logger?.debug || ((..._args: unknown[]) => {}),
      ...overrides?.logger,
    },
  };
}

/**
 * Assert that a response has a specific status code
 */
export function expectStatus(response: MockResponse, expectedStatus: number) {
  if (response.statusCode !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.statusCode}. Response: ${JSON.stringify(response.data)}`
    );
  }
}

/**
 * Assert that a response is a successful response
 */
export function expectSuccess(response: MockResponse, acceptCreated = true) {
  const validStatuses = acceptCreated ? [200, 201] : [200];
  if (!validStatuses.includes(response.statusCode)) {
    throw new Error(
      `Expected status ${validStatuses.join(' or ')} but got ${response.statusCode}. Response: ${JSON.stringify(response.data)}`
    );
  }
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Expected response data to be an object');
  }
}

/**
 * Assert that a response is an error response
 */
export function expectError(response: MockResponse, expectedStatus: number, errorMessage?: string) {
  expectStatus(response, expectedStatus);
  const data = response.data as { error?: string };
  if (!data || !data.error) {
    throw new Error('Expected response to contain an error field');
  }
  if (errorMessage && !data.error.includes(errorMessage)) {
    throw new Error(`Expected error message to contain "${errorMessage}" but got "${data.error}"`);
  }
}

/**
 * Assert that a response is a validation error
 */
export function expectValidationError(response: MockResponse, fieldName?: string) {
  expectStatus(response, 400);
  const data = response.data as { error?: { details?: unknown }; details?: unknown };
  // Support both formats: { details } and { error: { details } }
  const details = data?.error?.details || data?.details;
  if (!details) {
    throw new Error('Expected response to contain validation details');
  }
  if (fieldName) {
    // Handle both object format and array format
    let detailsObj: Record<string, unknown>;
    if (Array.isArray(details)) {
      // Convert array format to object format
      // Support both { field, message } and { field, constraints }
      detailsObj = {};
      for (const item of details as Array<{ field: string; message?: string; constraints?: string[] }>) {
        detailsObj[item.field] = item.message || item.constraints;
      }
    } else {
      detailsObj = details as Record<string, unknown>;
    }
    
    if (!detailsObj[fieldName]) {
      throw new Error(
        `Expected validation error for field "${fieldName}" but got: ${JSON.stringify(details)}`
      );
    }
  }
}
