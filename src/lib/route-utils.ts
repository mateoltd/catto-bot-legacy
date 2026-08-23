import type { Route } from '@sapphire/plugin-api';
import { Buffer } from 'node:buffer';

/**
 * Parses the JSON body from a Route.Request
 * @param request The incoming request
 * @returns The parsed JSON body or undefined if no body or invalid JSON
 */
export async function parseRequestBody(request: Route.Request): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += String(chunk);
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : undefined);
      } catch {
        resolve(undefined);
      }
    });
    request.on('error', reject);
  });
}
