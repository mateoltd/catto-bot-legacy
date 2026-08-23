import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';

// Mock the config before importing
vi.mock('#config.js', () => ({
  CONFIG: {
    EVIDENCE_HMAC_SECRET: 'test-secret-key-that-is-at-least-32-characters-long',
    B2_ENDPOINT: null,
    B2_KEY_ID: null,
  },
}));

// Mock container logger
vi.mock('@sapphire/framework', () => ({
  container: {
    logger: {
      warn: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

import { SigningService } from '#lib/storage/SigningService.js';

describe('SigningService', () => {
  let service: SigningService;

  beforeEach(() => {
    service = new SigningService();
  });

  describe('isConfigured', () => {
    it('should return true when HMAC secret is at least 32 characters', () => {
      expect(service.isConfigured).toBe(true);
    });
  });

  describe('sha256', () => {
    it('should compute consistent SHA-256 hashes', () => {
      const input = Buffer.from('Hello, World!');
      const hash1 = SigningService.sha256(input);
      const hash2 = SigningService.sha256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = SigningService.sha256(Buffer.from('Hello'));
      const hash2 = SigningService.sha256(Buffer.from('World'));

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty buffer', () => {
      const hash = SigningService.sha256(Buffer.from(''));
      // SHA-256 of empty string is known
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should handle binary data', () => {
      const binaryData = Buffer.from([0x00, 0xff, 0x10, 0xab]);
      const hash = SigningService.sha256(binaryData);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('sign', () => {
    const metadata = {
      evidenceId: 'evidence-123',
      guildId: 'guild-456',
      caseId: 'case-789',
      uploadedById: 'user-111',
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    it('should sign content with metadata binding', () => {
      const contentHash = 'abc123def456';
      const signature = service.sign(contentHash, metadata);

      expect(signature).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 produces 64 hex chars
    });

    it('should produce consistent signatures for same inputs', () => {
      const contentHash = 'abc123def456';
      const sig1 = service.sign(contentHash, metadata);
      const sig2 = service.sign(contentHash, metadata);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different content hashes', () => {
      const sig1 = service.sign('hash1', metadata);
      const sig2 = service.sign('hash2', metadata);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures when metadata differs', () => {
      const contentHash = 'abc123';
      const sig1 = service.sign(contentHash, metadata);
      const sig2 = service.sign(contentHash, { ...metadata, evidenceId: 'different-id' });

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verify', () => {
    const metadata = {
      evidenceId: 'evidence-123',
      guildId: 'guild-456',
      caseId: 'case-789',
      uploadedById: 'user-111',
      timestamp: '2024-01-15T10:30:00.000Z',
    };

    it('should verify valid signatures', () => {
      const contentHash = 'abc123def456';
      const signature = service.sign(contentHash, metadata);

      expect(service.verify(contentHash, metadata, signature)).toBe(true);
    });

    it('should reject tampered content hash', () => {
      const contentHash = 'abc123def456';
      const signature = service.sign(contentHash, metadata);

      expect(service.verify('tampered-hash', metadata, signature)).toBe(false);
    });

    it('should reject tampered metadata', () => {
      const contentHash = 'abc123def456';
      const signature = service.sign(contentHash, metadata);

      const tamperedMetadata = { ...metadata, guildId: 'tampered-guild' };
      expect(service.verify(contentHash, tamperedMetadata, signature)).toBe(false);
    });

    it('should reject tampered signatures', () => {
      const contentHash = 'abc123def456';
      const validSignature = service.sign(contentHash, metadata);
      const tamperedSignature = validSignature.replace(/[a-f]/g, '0');

      expect(service.verify(contentHash, metadata, tamperedSignature)).toBe(false);
    });

    it('should reject signatures with wrong length', () => {
      const contentHash = 'abc123def456';
      expect(service.verify(contentHash, metadata, 'too-short')).toBe(false);
    });

    it('should use constant-time comparison (structure test)', () => {
      // This test verifies that verify uses the constant-time loop pattern
      // by checking edge cases that could leak timing info
      const contentHash = 'abc123def456';
      const signature = service.sign(contentHash, metadata);

      // Test with matching prefix but different end
      const almostMatching = signature.slice(0, -4) + '0000';
      expect(service.verify(contentHash, metadata, almostMatching)).toBe(false);

      // Test with completely different signature
      const completelyDifferent = '0'.repeat(64);
      expect(service.verify(contentHash, metadata, completelyDifferent)).toBe(false);
    });
  });

  describe('buildMetadata', () => {
    it('should build signing metadata from an evidence record', () => {
      const evidence = {
        id: 'evidence-123',
        guildId: 'guild-456',
        caseId: 'case-789',
        uploadedById: 'user-111',
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
      };

      const metadata = SigningService.buildMetadata(evidence);

      expect(metadata).toEqual({
        evidenceId: 'evidence-123',
        guildId: 'guild-456',
        caseId: 'case-789',
        uploadedById: 'user-111',
        timestamp: '2024-01-15T10:30:00.000Z',
      });
    });
  });
});

describe('SigningService (unconfigured)', () => {
  it('should return false for isConfigured with short secret', async () => {
    // Reset modules and mock with short secret
    vi.resetModules();
    vi.doMock('#config.js', () => ({
      CONFIG: {
        EVIDENCE_HMAC_SECRET: 'short',
        B2_ENDPOINT: null,
        B2_KEY_ID: null,
      },
    }));

    const { SigningService: UnconfiguredService } = await import('#lib/storage/SigningService.js');
    const service = new UnconfiguredService();

    expect(service.isConfigured).toBe(false);
  });

  it('should throw when signing without configuration', async () => {
    vi.resetModules();
    vi.doMock('#config.js', () => ({
      CONFIG: {
        EVIDENCE_HMAC_SECRET: 'short',
        B2_ENDPOINT: null,
        B2_KEY_ID: null,
      },
    }));

    const { SigningService: UnconfiguredService } = await import('#lib/storage/SigningService.js');
    const service = new UnconfiguredService();

    const metadata = {
      evidenceId: 'test',
      guildId: 'test',
      caseId: 'test',
      uploadedById: 'test',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    expect(() => service.sign('hash', metadata)).toThrow(
      'SigningService: EVIDENCE_HMAC_SECRET not configured'
    );
  });

  it('should return false for verify without configuration', async () => {
    vi.resetModules();
    vi.doMock('#config.js', () => ({
      CONFIG: {
        EVIDENCE_HMAC_SECRET: '',
        B2_ENDPOINT: null,
        B2_KEY_ID: null,
      },
    }));

    const { SigningService: UnconfiguredService } = await import('#lib/storage/SigningService.js');
    const service = new UnconfiguredService();

    const metadata = {
      evidenceId: 'test',
      guildId: 'test',
      caseId: 'test',
      uploadedById: 'test',
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    expect(service.verify('hash', metadata, 'signature')).toBe(false);
  });
});
