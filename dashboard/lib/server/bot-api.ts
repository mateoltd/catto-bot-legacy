const DEFAULT_BOT_API_INTERNAL_URL = 'http://localhost:4000';

export function getBotApiInternalUrl(): string {
  const configuredUrl = process.env.BOT_API_INTERNAL_URL || DEFAULT_BOT_API_INTERNAL_URL;
  const url = new URL(configuredUrl);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('BOT_API_INTERNAL_URL must use HTTP or HTTPS');
  }

  return url.toString().replace(/\/$/, '');
}

export function botApiUrl(path: string): string {
  return `${getBotApiInternalUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
