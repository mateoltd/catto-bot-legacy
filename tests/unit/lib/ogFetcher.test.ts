import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dns from 'node:dns/promises';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock DNS
vi.mock('node:dns/promises', () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

import axios from 'axios';
import { fetchOGData } from '#lib/utils/ogFetcher.js';

describe('ogFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: DNS resolves to public IPs
    vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
    vi.mocked(dns.resolve6).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('SSRF Protection', () => {
    it('should reject localhost URLs', async () => {
      const result = await fetchOGData('http://localhost/page');

      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should reject localhost with port', async () => {
      const result = await fetchOGData('http://localhost:8080/api');

      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should reject 127.0.0.1 addresses directly (without DNS)', async () => {
      // Direct IP addresses are checked before DNS resolution
      const result = await fetchOGData('http://127.0.0.1/secret');

      expect(result).toBeNull();
      // DNS should not even be called for direct private IPs
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should reject direct private IP addresses', async () => {
      // Test various private IP formats directly in the URL
      const privateIPs = [
        'http://10.0.0.1/admin',
        'http://172.16.0.1/internal',
        'http://192.168.1.1/router',
        'http://169.254.169.254/metadata', // AWS metadata
      ];

      for (const url of privateIPs) {
        const result = await fetchOGData(url);
        expect(result).toBeNull();
      }
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should allow public IP addresses when DNS returns empty', async () => {
      // Public IPs should be allowed even when DNS returns empty
      vi.mocked(dns.resolve4).mockResolvedValue([]);
      vi.mocked(dns.resolve6).mockResolvedValue([]);
      vi.mocked(axios.get).mockResolvedValue({ data: '<html><head><title>Test</title></head></html>' });

      // 203.0.113.x is TEST-NET-3, which is actually in the reserved range
      // Use a clearly public IP instead
      const result = await fetchOGData('http://8.8.8.8/page');

      expect(result?.title).toBe('Test');
    });

    it('should reject 10.x.x.x private addresses', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue(['10.0.0.1']);

      const result = await fetchOGData('http://internal-server.example.com/');

      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should reject 172.16.x.x-172.31.x.x private addresses', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue(['172.16.0.1']);

      const result = await fetchOGData('http://internal.example.com/');

      expect(result).toBeNull();
    });

    it('should reject 192.168.x.x private addresses', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue(['192.168.1.1']);

      const result = await fetchOGData('http://router.local/');

      expect(result).toBeNull();
    });

    it('should reject 169.254.x.x link-local addresses', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue(['169.254.169.254']);

      const result = await fetchOGData('http://metadata.google.internal/');

      expect(result).toBeNull();
    });

    it('should reject AWS/cloud metadata endpoint addresses', async () => {
      // The hostname check catches metadata.google.internal first
      const result = await fetchOGData('http://metadata.google.internal/computeMetadata/v1/');

      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should reject .internal hostnames', async () => {
      const result = await fetchOGData('http://secret-service.internal/data');

      expect(result).toBeNull();
    });

    it('should reject .local hostnames', async () => {
      const result = await fetchOGData('http://my-device.local/');

      expect(result).toBeNull();
    });

    it('should reject non-http/https protocols', async () => {
      const result = await fetchOGData('file:///etc/passwd');

      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should reject ftp protocol', async () => {
      const result = await fetchOGData('ftp://ftp.example.com/file');

      expect(result).toBeNull();
    });

    it('should reject IPv6 loopback', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue([]);
      vi.mocked(dns.resolve6).mockResolvedValue(['::1']);

      const result = await fetchOGData('http://ipv6-host.example.com/');

      expect(result).toBeNull();
    });

    it('should reject IPv6 link-local addresses', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue([]);
      vi.mocked(dns.resolve6).mockResolvedValue(['fe80::1']);

      const result = await fetchOGData('http://ipv6-local.example.com/');

      expect(result).toBeNull();
    });

    it('should reject IPv4-mapped IPv6 private addresses', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue([]);
      vi.mocked(dns.resolve6).mockResolvedValue(['::ffff:192.168.1.1']);

      const result = await fetchOGData('http://mapped-private.example.com/');

      expect(result).toBeNull();
    });

    it('should allow valid public URLs', async () => {
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']); // example.com IP
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><title>Example</title><meta property="og:title" content="Test Page"></head></html>',
      });

      const result = await fetchOGData('https://example.com/page');

      expect(axios.get).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ title: 'Test Page' }));
    });
  });

  describe('OG Metadata Parsing', () => {
    beforeEach(() => {
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
    });

    it('should extract og:title', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta property="og:title" content="My Page Title"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.title).toBe('My Page Title');
    });

    it('should extract og:description', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta property="og:description" content="A description of the page."></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.description).toBe('A description of the page.');
    });

    it('should extract og:image', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta property="og:image" content="https://example.com/image.jpg"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.image).toBe('https://example.com/image.jpg');
    });

    it('should extract og:site_name', async () => {
      // Note: fetchOGData returns null if no title/description/image found
      // So we need to include at least one primary field alongside site_name
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta property="og:site_name" content="Example Site"><meta property="og:title" content="Page Title"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.siteName).toBe('Example Site');
      expect(result?.title).toBe('Page Title');
    });

    it('should fall back to twitter:title when og:title is missing', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta name="twitter:title" content="Twitter Title"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.title).toBe('Twitter Title');
    });

    it('should fall back to <title> when both og and twitter are missing', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><title>Page Title</title></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.title).toBe('Page Title');
    });

    it('should fall back to meta description when og:description is missing', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta name="description" content="Meta description"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.description).toBe('Meta description');
    });

    it('should decode HTML entities in extracted content', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta property="og:title" content="Tom &amp; Jerry&#39;s &quot;Adventure&quot;"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.title).toBe("Tom & Jerry's \"Adventure\"");
    });

    it('should handle meta tags with content before property', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><meta content="Reversed Order" property="og:title"></head></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result?.title).toBe('Reversed Order');
    });

    it('should return null when no metadata is found', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head></head><body>No meta tags here</body></html>',
      });

      const result = await fetchOGData('https://example.com');

      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
    });

    it('should return null on network timeout', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await fetchOGData('https://slow-site.com', 1000);

      expect(result).toBeNull();
    });

    it('should return null on HTTP error status', async () => {
      vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } });

      const result = await fetchOGData('https://example.com/nonexistent');

      expect(result).toBeNull();
    });

    it('should return null for invalid URLs', async () => {
      const result = await fetchOGData('not-a-valid-url');

      expect(result).toBeNull();
    });

    it('should handle DNS resolution failures gracefully', async () => {
      vi.mocked(dns.resolve4).mockRejectedValue(new Error('NXDOMAIN'));
      vi.mocked(dns.resolve6).mockRejectedValue(new Error('NXDOMAIN'));

      // URL with direct public IP should still work
      vi.mocked(axios.get).mockResolvedValue({
        data: '<html><head><title>Test</title></head></html>',
      });

      const result = await fetchOGData('http://93.184.216.34/page');

      // DNS failed, but IP is public, so it should proceed
      expect(result).toEqual(expect.objectContaining({ title: 'Test' }));
    });
  });

  describe('oEmbed Provider Support', () => {
    beforeEach(() => {
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
    });

    it('should use YouTube oEmbed endpoint', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          title: 'YouTube Video Title',
          thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
          provider_name: 'YouTube',
        },
      });

      const result = await fetchOGData('https://www.youtube.com/watch?v=abc123');

      expect(axios.get).toHaveBeenCalledWith(
        'https://www.youtube.com/oembed',
        expect.objectContaining({
          params: expect.objectContaining({ url: 'https://www.youtube.com/watch?v=abc123' }),
        })
      );
      expect(result?.title).toBe('YouTube Video Title');
      expect(result?.siteName).toBe('YouTube');
    });

    it('should use Twitter oEmbed endpoint', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          title: 'Tweet content',
          provider_name: 'Twitter',
        },
      });

      await fetchOGData('https://twitter.com/user/status/123456');

      expect(axios.get).toHaveBeenCalledWith(
        'https://publish.twitter.com/oembed',
        expect.anything()
      );
    });

    it('should fall back to HTML parsing when oEmbed fails', async () => {
      // First call (oEmbed) fails
      vi.mocked(axios.get)
        .mockRejectedValueOnce(new Error('oEmbed failed'))
        // Second call (HTML) succeeds
        .mockResolvedValueOnce({
          data: '<html><head><meta property="og:title" content="Fallback Title"></head></html>',
        });

      const result = await fetchOGData('https://www.youtube.com/watch?v=test');

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result?.title).toBe('Fallback Title');
    });
  });
});
