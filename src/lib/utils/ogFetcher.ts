import axios from 'axios';
import { validateUrl } from '#lib/security/ssrf.js';

export interface OGData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};
// oEmbed endpoints for providers that block bot UAs or require JS rendering
const OEMBED_PROVIDERS: { pattern: RegExp; endpoint: string }[] = [
  {
    pattern: /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/,
    endpoint: 'https://www.youtube.com/oembed',
  },
  {
    pattern: /(?:twitter\.com|x\.com)\/\w+\/status\//,
    endpoint: 'https://publish.twitter.com/oembed',
  },
  {
    pattern: /vimeo\.com\/\d+/,
    endpoint: 'https://vimeo.com/api/oembed.json',
  },
  {
    pattern: /soundcloud\.com\/.+\/.+/,
    endpoint: 'https://soundcloud.com/oembed',
  },
  {
    pattern: /open\.spotify\.com\/(track|album|playlist|episode)\//,
    endpoint: 'https://open.spotify.com/oembed',
  },
];

/**
 * Fetch OpenGraph metadata from a URL.
 * Tries oEmbed first for known providers, falls back to HTML meta parsing.
 * Includes SSRF protection - blocks private/internal IP addresses.
 * Fails silently on timeout/error, returning null.
 */
export async function fetchOGData(url: string, timeout = 5000): Promise<OGData | null> {
  // SSRF protection: validate URL before making any requests
  if (!(await validateUrl(url))) {
    return null;
  }

  // Try oEmbed first for known providers
  const oembedEndpoint = findOEmbedEndpoint(url);
  if (oembedEndpoint) {
    const result = await fetchViaOEmbed(url, oembedEndpoint, timeout);
    if (result) return result;
  }

  // Fall back to HTML meta tag parsing
  try {
    const response = await axios.get(url, {
      timeout,
      maxContentLength: 512 * 1024, // 512KB max
      headers: BROWSER_HEADERS,
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const html = typeof response.data === 'string' ? response.data : '';

    const title =
      extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title') ?? extractTitle(html);
    const description =
      extractMeta(html, 'og:description') ??
      extractMeta(html, 'twitter:description') ??
      extractMetaByName(html, 'description');
    const image = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image');
    const siteName = extractMeta(html, 'og:site_name');

    if (!title && !description && !image) return null;

    return { title, description, image, siteName };
  } catch {
    return null;
  }
}

function findOEmbedEndpoint(url: string): string | null {
  for (const { pattern, endpoint } of OEMBED_PROVIDERS) {
    if (pattern.test(url)) return endpoint;
  }
  return null;
}

async function fetchViaOEmbed(
  url: string,
  endpoint: string,
  timeout: number
): Promise<OGData | null> {
  try {
    const res = await axios.get(endpoint, {
      params: { url, format: 'json' },
      timeout,
      headers: BROWSER_HEADERS,
    });

    const data = res.data;
    if (!data) return null;

    const og: OGData = {};
    if (data.title) og.title = String(data.title);
    if (data.thumbnail_url) og.image = String(data.thumbnail_url);
    if (data.provider_name) og.siteName = String(data.provider_name);
    if (data.description) og.description = String(data.description);

    return og.title || og.image ? og : null;
  } catch {
    return null;
  }
}

function extractMeta(html: string, property: string): string | undefined {
  const escaped = escapeRegex(property);
  const patterns = [
    // property/name first, then content
    new RegExp(
      `<meta[^>]*?(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*?)["']`,
      'i'
    ),
    // content first, then property/name
    new RegExp(
      `<meta[^>]*?content\\s*=\\s*["']([^"']*?)["'][^>]*?(?:property|name)\\s*=\\s*["']${escaped}["']`,
      'i'
    ),
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]?.trim()) return decodeHTMLEntities(match[1].trim());
  }
  return undefined;
}

function extractMetaByName(html: string, name: string): string | undefined {
  const escaped = escapeRegex(name);
  const patterns = [
    new RegExp(
      `<meta[^>]*?name\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*?)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]*?content\\s*=\\s*["']([^"']*?)["'][^>]*?name\\s*=\\s*["']${escaped}["']`,
      'i'
    ),
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]?.trim()) return decodeHTMLEntities(match[1].trim());
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ? decodeHTMLEntities(match[1].trim()) : undefined;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
