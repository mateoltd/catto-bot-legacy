/**
 * Signing/verification integration tests.
 *
 * Tests the cryptographic signing chain with REAL crypto — no mocking
 * of SigningService internals. Verifies sign/verify roundtrips,
 * tamper detection, HMAC secret requirements, and SHA-256 determinism.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';

// ─── Hoisted mocks ─

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    EVIDENCE_HMAC_SECRET: 'a-secret-that-is-at-least-32-characters-long!!',
    B2_ENDPOINT: undefined as string | undefined,
    B2_KEY_ID: undefined as string | undefined,
  },
}));

vi.mock('#config.js', () => ({
  CONFIG: mockConfig,
}));

// Mock the container logger to prevent setTimeout warning output
vi.mock('@sapphire/framework', () => ({
  container: {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
    prisma: {
      evidence: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  },
}));

// ─── Imports (after mocks) 

import { SigningService, type SigningMetadata } from '#lib/storage/SigningService.js';

// ─── Helpers 

function createMetadata(overrides?: Partial<SigningMetadata>): SigningMetadata {
  return {
    evidenceId: 'ev-abc-123',
    guildId: 'guild-123',
    caseId: 'case-456',
    uploadedById: 'user-789',
    timestamp: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ──

describe('Signing/verification integration', () => {
  let service: SigningService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset config to valid secret
    mockConfig.EVIDENCE_HMAC_SECRET = 'a-secret-that-is-at-least-32-characters-long!!';
    service = new SigningService();
  });

  // ─── 1. Sign and verify roundtrip ─────

  describe('Sign and verify roundtrip', () => {
    it('signing then verifying with same content hash and metadata passes', () => {
      const contentHash = SigningService.sha256(Buffer.from('evidence file content'));
      const metadata = createMetadata();

      const signature = service.sign(contentHash, metadata);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA-256 hex = 64 chars

      const isValid = service.verify(contentHash, metadata, signature);
      expect(isValid).toBe(true);
    });

    it('different content produces different signatures', () => {
      const hash1 = SigningService.sha256(Buffer.from('content A'));
      const hash2 = SigningService.sha256(Buffer.from('content B'));
      const metadata = createMetadata();

      const sig1 = service.sign(hash1, metadata);
      const sig2 = service.sign(hash2, metadata);

      expect(sig1).not.toBe(sig2);
    });
  });

  // ─── 2. Tampered content hash ─

  describe('Tampered content hash', () => {
    it('verification fails when content hash is changed after signing', () => {
      const originalHash = SigningService.sha256(Buffer.from('original content'));
      const metadata = createMetadata();

      const signature = service.sign(originalHash, metadata);

      // Tamper with the hash
      const tamperedHash = SigningService.sha256(Buffer.from('tampered content'));
      const isValid = service.verify(tamperedHash, metadata, signature);

      expect(isValid).toBe(false);
    });
  });

  // ─── 3. Tampered metadata 

  describe('Tampered metadata', () => {
    it('verification fails when evidenceId is changed', () => {
      const contentHash = SigningService.sha256(Buffer.from('test content'));
      const metadata = createMetadata();

      const signature = service.sign(contentHash, metadata);

      // Change evidenceId
      const tamperedMetadata = createMetadata({ evidenceId: 'ev-different' });
      expect(service.verify(contentHash, tamperedMetadata, signature)).toBe(false);
    });

    it('verification fails when guildId is changed', () => {
      const contentHash = SigningService.sha256(Buffer.from('test content'));
      const metadata = createMetadata();

      const signature = service.sign(contentHash, metadata);

      const tamperedMetadata = createMetadata({ guildId: 'guild-other' });
      expect(service.verify(contentHash, tamperedMetadata, signature)).toBe(false);
    });

    it('verification fails when caseId is changed', () => {
      const contentHash = SigningService.sha256(Buffer.from('test content'));
      const metadata = createMetadata();

      const signature = service.sign(contentHash, metadata);

      const tamperedMetadata = createMetadata({ caseId: 'case-other' });
      expect(service.verify(contentHash, tamperedMetadata, signature)).toBe(false);
    });

    it('verification fails when uploadedById is changed', () => {
      const contentHash = SigningService.sha256(Buffer.from('test content'));
      const metadata = createMetadata();

      const signature = service.sign(contentHash, metadata);

      const tamperedMetadata = createMetadata({ uploadedById: 'user-attacker' });
      expect(service.verify(contentHash, tamperedMetadata, signature)).toBe(false);
    });

    it('verification fails when timestamp is changed', () => {
      const contentHash = SigningService.sha256(Buffer.from('test content'));
      const metadata = createMetadata();

      const signature = service.sign(contentHash, metadata);

      const tamperedMetadata = createMetadata({ timestamp: '2030-12-31T23:59:59.000Z' });
      expect(service.verify(contentHash, tamperedMetadata, signature)).toBe(false);
    });
  });

  // ─── 4. Missing HMAC secret ───

  describe('Missing HMAC secret', () => {
    it('isConfigured returns false when secret is empty', () => {
      mockConfig.EVIDENCE_HMAC_SECRET = undefined as any;
      const unconfiguredService = new SigningService();

      expect(unconfiguredService.isConfigured).toBe(false);
    });

    it('sign throws when secret is not configured', () => {
      mockConfig.EVIDENCE_HMAC_SECRET = undefined as any;
      const unconfiguredService = new SigningService();

      expect(() => {
        unconfiguredService.sign('hash', createMetadata());
      }).toThrow('EVIDENCE_HMAC_SECRET not configured');
    });

    it('verify returns false when secret is not configured', () => {
      mockConfig.EVIDENCE_HMAC_SECRET = undefined as any;
      const unconfiguredService = new SigningService();

      const result = unconfiguredService.verify('hash', createMetadata(), 'signature');
      expect(result).toBe(false);
    });
  });

  // ─── 5. Short HMAC secret 

  describe('Short HMAC secret', () => {
    it('isConfigured returns false when secret is less than 32 chars', () => {
      mockConfig.EVIDENCE_HMAC_SECRET = 'too-short';
      const shortSecretService = new SigningService();

      expect(shortSecretService.isConfigured).toBe(false);
    });

    it('exactly 32 chars is configured', () => {
      mockConfig.EVIDENCE_HMAC_SECRET = 'a'.repeat(32);
      const exactService = new SigningService();

      expect(exactService.isConfigured).toBe(true);
    });
  });

  // ─── 6. SHA-256 determinism ───

  describe('SHA-256 determinism', () => {
    it('same buffer produces same hash every time', () => {
      const buffer = Buffer.from('deterministic content test');

      const hash1 = SigningService.sha256(buffer);
      const hash2 = SigningService.sha256(buffer);
      const hash3 = SigningService.sha256(buffer);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1.length).toBe(64); // hex-encoded SHA-256
    });

    it('different buffers produce different hashes', () => {
      const hash1 = SigningService.sha256(Buffer.from('content A'));
      const hash2 = SigningService.sha256(Buffer.from('content B'));

      expect(hash1).not.toBe(hash2);
    });

    it('empty buffer has a deterministic hash', () => {
      const hash1 = SigningService.sha256(Buffer.from(''));
      const hash2 = SigningService.sha256(Buffer.from(''));

      expect(hash1).toBe(hash2);
      // Known SHA-256 of empty string
      expect(hash1).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  // ─── 7. Constant-time comparison 

  describe('Constant-time comparison', () => {
    it('verify rejects signatures with wrong length', () => {
      const contentHash = SigningService.sha256(Buffer.from('test'));
      const metadata = createMetadata();
      const signature = service.sign(contentHash, metadata);

      // Truncated signature (wrong length)
      expect(service.verify(contentHash, metadata, signature.slice(0, 32))).toBe(false);
    });

    it('verify rejects completely different valid-length signatures', () => {
      const contentHash = SigningService.sha256(Buffer.from('test'));
      const metadata = createMetadata();
      service.sign(contentHash, metadata);

      // A fabricated 64-char hex string
      const fakeSignature = 'a'.repeat(64);
      expect(service.verify(contentHash, metadata, fakeSignature)).toBe(false);
    });

    it('verify rejects signature with single bit difference', () => {
      const contentHash = SigningService.sha256(Buffer.from('test'));
      const metadata = createMetadata();
      const signature = service.sign(contentHash, metadata);

      // Flip one character
      const chars = signature.split('');
      chars[0] = chars[0] === 'a' ? 'b' : 'a';
      const tamperedSig = chars.join('');

      expect(service.verify(contentHash, metadata, tamperedSig)).toBe(false);
    });
  });

  // ─── 8. buildMetadata helper ──

  describe('buildMetadata helper', () => {
    it('constructs correct metadata from evidence record', () => {
      const evidence = {
        id: 'ev-test-123',
        guildId: 'guild-456',
        caseId: 'case-789',
        uploadedById: 'user-abc',
        createdAt: new Date('2025-06-15T12:00:00Z'),
      };

      const metadata = SigningService.buildMetadata(evidence);

      expect(metadata).toEqual({
        evidenceId: 'ev-test-123',
        guildId: 'guild-456',
        caseId: 'case-789',
        uploadedById: 'user-abc',
        timestamp: '2025-06-15T12:00:00.000Z',
      });
    });
  });

  // ─── 9. End-to-end signing flow ─

  describe('End-to-end signing flow', () => {
    it('simulate full upload confirm: hash content → sign → verify', () => {
      // Simulate actual file content
      const fileContent = Buffer.from('PNG file binary data here...');
      const contentHash = SigningService.sha256(fileContent);

      // Simulate evidence record after creation
      const evidence = {
        id: 'ev-real-upload',
        guildId: 'guild-production',
        caseId: 'case-42',
        uploadedById: 'mod-user',
        createdAt: new Date('2025-03-15T08:30:00Z'),
      };

      const metadata = SigningService.buildMetadata(evidence);

      // Sign during confirmUpload
      expect(service.isConfigured).toBe(true);
      const signature = service.sign(contentHash, metadata);

      // Later verification should pass
      expect(service.verify(contentHash, metadata, signature)).toBe(true);

      // Tampering with file should fail
      const tamperedContent = Buffer.from('PNG file MODIFIED data...');
      const tamperedHash = SigningService.sha256(tamperedContent);
      expect(service.verify(tamperedHash, metadata, signature)).toBe(false);

      // Reassigning to different case should fail
      const reassignedMetadata = SigningService.buildMetadata({
        ...evidence,
        caseId: 'case-99',
      });
      expect(service.verify(contentHash, reassignedMetadata, signature)).toBe(false);
    });
  });

  // ─── 10. Cross-guild signature reuse prevention ────

  describe('Cross-guild signature reuse', () => {
    it('signature from guild A cannot verify for guild B with same content', () => {
      const contentHash = SigningService.sha256(Buffer.from('shared content'));

      const metadataA = createMetadata({ guildId: 'guild-A' });
      const metadataB = createMetadata({ guildId: 'guild-B' });

      const signatureA = service.sign(contentHash, metadataA);

      // Same content hash, different guild → verification must fail
      expect(service.verify(contentHash, metadataB, signatureA)).toBe(false);

      // Same guild → verification must pass
      expect(service.verify(contentHash, metadataA, signatureA)).toBe(true);
    });
  });
});
