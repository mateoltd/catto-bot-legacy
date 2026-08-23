import { URL } from 'node:url';
import dns from 'node:dns/promises';

/**
 * SSRF (Server-Side Request Forgery) Protection Module
 *
 * Provides URL validation and IP address filtering to prevent
 * the application from making requests to internal/private networks.
 *
 * Usage:
 *   import { validateUrl, isPrivateIP } from '#lib/security/ssrf.js';
 *
 *   if (!(await validateUrl(userProvidedUrl))) {
 *     return null; // Block the request
 *   }
 */

// ─── Private IP Detection ───────────────────────────────────────────────────

/** IPv4 private/reserved address patterns */
const IPV4_PRIVATE_PATTERNS: RegExp[] = [
  /^127\./, // Loopback
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT
  /^192\.0\.0\./, // IETF protocol assignments
  /^192\.0\.2\./, // TEST-NET-1
  /^198\.51\.100\./, // TEST-NET-2
  /^203\.0\.113\./, // TEST-NET-3
  /^192\.88\.99\./, // 6to4 relay anycast
  /^224\./, // Multicast
  /^240\./, // Reserved
  /^255\.255\.255\.255$/, // Broadcast
];

/** IPv6 private/reserved address patterns */
const IPV6_PRIVATE_PATTERNS: RegExp[] = [
  /^::1$/, // Loopback
  /^fe80:/i, // Link-local
  /^fc00:/i, // Unique local
  /^fd00:/i, // Unique local
  /^ff00:/i, // Multicast
  /^::ffff:127\./i, // IPv4-mapped loopback
  /^::ffff:10\./i, // IPv4-mapped private
  /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i, // IPv4-mapped private
  /^::ffff:192\.168\./i, // IPv4-mapped private
  /^::ffff:169\.254\./i, // IPv4-mapped link-local
];

/** Hostnames that should always be blocked */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);

/** Hostname suffixes that should always be blocked */
const BLOCKED_HOSTNAME_SUFFIXES = ['.internal', '.local'];

/**
 * Check if an IP address is private/internal.
 * Blocks: loopback, private ranges, link-local, metadata services,
 * carrier-grade NAT, multicast, reserved, and broadcast addresses.
 */
export function isPrivateIP(ip: string): boolean {
  for (const pattern of IPV4_PRIVATE_PATTERNS) {
    if (pattern.test(ip)) return true;
  }
  for (const pattern of IPV6_PRIVATE_PATTERNS) {
    if (pattern.test(ip)) return true;
  }
  return false;
}

/**
 * Validate a URL for SSRF protection.
 * Only allows http/https and blocks private/internal IP addresses.
 * Performs DNS resolution to catch domains that resolve to private IPs.
 */
export async function validateUrl(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // Block known internal hostnames
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return false;
    }
    for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        return false;
      }
    }

    // Check if hostname is a direct IP address
    if (isPrivateIP(hostname)) {
      return false;
    }

    // Resolve hostname and check if resolved IPs are private
    // This catches domains that resolve to private IPs (DNS rebinding)
    const addresses = await dns.resolve4(hostname).catch(() => []);
    const addresses6 = await dns.resolve6(hostname).catch(() => []);
    const allAddresses = [...addresses, ...addresses6];

    for (const ip of allAddresses) {
      if (isPrivateIP(ip)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
