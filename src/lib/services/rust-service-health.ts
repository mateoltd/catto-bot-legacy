/* global AbortController, fetch */

export type RustServiceHealth =
  | {
      ok: true;
      url: string;
      latencyMs: number;
      version?: string;
    }
  | {
      ok: false;
      url: string;
      latencyMs: number;
      error: string;
    };

interface HealthResponse {
  status?: unknown;
  version?: unknown;
}

const DEFAULT_HEALTH_TIMEOUT = 2_000;

function describeConnectionError(error: unknown, timeoutMs: number): string {
  if (!(error instanceof Error)) return String(error);
  if (error.name === 'AbortError') return `timed out after ${timeoutMs}ms`;

  const cause = error.cause;
  if (cause instanceof Error) {
    const code = 'code' in cause && typeof cause.code === 'string' ? `${cause.code} ` : '';
    return `${error.message}: ${code}${cause.message}`;
  }

  return error.message;
}

export async function checkRustServiceHealth(
  serviceUrl: string,
  timeoutMs = DEFAULT_HEALTH_TIMEOUT
): Promise<RustServiceHealth> {
  const baseUrl = serviceUrl.replace(/\/+$/, '');
  const healthUrl = `${baseUrl}/health`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        url: baseUrl,
        latencyMs,
        error: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
      };
    }

    const body = (await response.json().catch(() => null)) as HealthResponse | null;
    if (body?.status !== 'ok') {
      return {
        ok: false,
        url: baseUrl,
        latencyMs,
        error: 'invalid health response',
      };
    }

    return {
      ok: true,
      url: baseUrl,
      latencyMs,
      ...(typeof body.version === 'string' && { version: body.version }),
    };
  } catch (error) {
    return {
      ok: false,
      url: baseUrl,
      latencyMs: Date.now() - startedAt,
      error: describeConnectionError(error, timeoutMs),
    };
  } finally {
    clearTimeout(timeout);
  }
}
