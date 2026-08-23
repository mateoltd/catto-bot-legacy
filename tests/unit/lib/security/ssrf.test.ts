import { describe, it, expect, vi, beforeEach } from 'vitest';
import dns from 'node:dns/promises';

vi.mock('node:dns/promises', () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

import { isPrivateIP, validateUrl } from '#lib/security/ssrf';

describe('SSRF Protection Module', () => {
  describe('isPrivateIP', () => {
    // IPv4 private ranges
    it.each([
      ['127.0.0.1', 'loopback'],
      ['127.255.255.255', 'loopback range'],
      ['10.0.0.1', 'Class A private'],
      ['10.255.255.255', 'Class A private end'],
      ['172.16.0.1', 'Class B private start'],
      ['172.31.255.255', 'Class B private end'],
      ['192.168.0.1', 'Class C private'],
      ['192.168.255.255', 'Class C private end'],
      ['169.254.1.1', 'link-local'],
      ['0.0.0.0', 'current network'],
      ['100.64.0.1', 'carrier-grade NAT'],
      ['100.127.255.255', 'carrier-grade NAT end'],
      ['192.0.0.1', 'IETF protocol'],
      ['192.0.2.1', 'TEST-NET-1'],
      ['198.51.100.1', 'TEST-NET-2'],
      ['203.0.113.1', 'TEST-NET-3'],
      ['192.88.99.1', '6to4 relay'],
      ['224.0.0.1', 'multicast'],
      ['240.0.0.1', 'reserved'],
      ['255.255.255.255', 'broadcast'],
    ])('should block %s (%s)', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });

    // IPv6 private ranges
    it.each([
      ['::1', 'loopback'],
      ['fe80::1', 'link-local'],
      ['fc00::1', 'unique local'],
      ['fd00::1', 'unique local'],
      ['ff00::1', 'multicast'],
      ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
      ['::ffff:10.0.0.1', 'IPv4-mapped private'],
      ['::ffff:172.16.0.1', 'IPv4-mapped private B'],
      ['::ffff:192.168.1.1', 'IPv4-mapped private C'],
      ['::ffff:169.254.1.1', 'IPv4-mapped link-local'],
    ])('should block IPv6 %s (%s)', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });

    // Public IPs should pass
    it.each([
      ['8.8.8.8', 'Google DNS'],
      ['1.1.1.1', 'Cloudflare DNS'],
      ['93.184.216.34', 'example.com'],
      ['172.15.255.255', 'just below Class B private'],
      ['172.32.0.0', 'just above Class B private'],
      ['100.63.255.255', 'just below CGNAT'],
      ['100.128.0.0', 'just above CGNAT'],
    ])('should allow %s (%s)', (ip) => {
      expect(isPrivateIP(ip)).toBe(false);
    });
  });

  describe('validateUrl', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
      vi.mocked(dns.resolve6).mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946']);
    });

    it('should reject non-http protocols', async () => {
      expect(await validateUrl('ftp://example.com')).toBe(false);
      expect(await validateUrl('file:///etc/passwd')).toBe(false);
      expect(await validateUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject localhost', async () => {
      expect(await validateUrl('http://localhost')).toBe(false);
      expect(await validateUrl('https://localhost:3000')).toBe(false);
    });

    it('should reject internal hostnames', async () => {
      expect(await validateUrl('http://metadata')).toBe(false);
      expect(await validateUrl('http://metadata.google.internal')).toBe(false);
      expect(await validateUrl('http://something.internal')).toBe(false);
      expect(await validateUrl('http://printer.local')).toBe(false);
    });

    it('should reject direct private IPs', async () => {
      expect(await validateUrl('http://127.0.0.1')).toBe(false);
      expect(await validateUrl('http://10.0.0.1')).toBe(false);
      expect(await validateUrl('http://192.168.1.1')).toBe(false);
    });

    it('should reject invalid URLs', async () => {
      expect(await validateUrl('not-a-url')).toBe(false);
      expect(await validateUrl('')).toBe(false);
    });

    it('should allow valid public URLs', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34', '142.250.190.14']);
      vi.mocked(dns.resolve6).mockResolvedValue([]);
      expect(await validateUrl('https://example.com')).toBe(true);
      expect(await validateUrl('https://google.com')).toBe(true);
    });
  });
});
