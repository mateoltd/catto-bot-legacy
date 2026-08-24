import { NextRequest, NextResponse } from 'next/server';
import { getBotApiInternalUrl } from '@/lib/server/bot-api';

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
const HOP_BY_HOP_HEADERS = [
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

async function proxyBotApi(request: NextRequest): Promise<NextResponse> {
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, getBotApiInternalUrl());
  const headers = new Headers(request.headers);

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: BODYLESS_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
    });
  } catch (error) {
    console.error('Bot API proxy request failed', error);
    return NextResponse.json({ error: 'Bot API unavailable' }, { status: 502 });
  }

  const responseHeaders = new Headers(response.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header);
  }

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyBotApi;
export const POST = proxyBotApi;
export const PUT = proxyBotApi;
export const PATCH = proxyBotApi;
export const DELETE = proxyBotApi;
export const OPTIONS = proxyBotApi;
export const HEAD = proxyBotApi;
