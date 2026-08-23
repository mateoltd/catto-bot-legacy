import { describe, it, expect } from 'vitest';
import { validateDto } from '#lib/validation/validate-dto.js';
import {
  CreatePermissionGrantDto,
  PermissionFilterDto,
} from '#lib/dtos/permissions/permission-grant.dto.js';

describe('CreatePermissionGrantDto', () => {
  describe('required fields', () => {
    it('requires subjectType', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'subjectType')).toBe(true);
    });

    it('requires subjectId', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'subjectId')).toBe(true);
    });

    it('requires resourceType', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'resourceType')).toBe(true);
    });

    it('requires resourceKey', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'resourceKey')).toBe(true);
    });

    it('requires effect', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'effect')).toBe(true);
    });

    it('accepts optional createdById', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('subjectType validation', () => {
    it('accepts ROLE', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('accepts USER', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'USER',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid subject type', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'INVALID',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('resourceType validation', () => {
    it('accepts COMMAND', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('accepts MODULE', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'MODULE',
        resourceKey: 'moderation',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid resource type', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'INVALID',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('effect validation', () => {
    it('accepts ALLOW', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('accepts DENY', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'DENY',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid effect', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'MAYBE',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Discord ID fields', () => {
    it('rejects invalid Discord ID for subjectId', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: 'any-string-value',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid Discord ID for subjectId', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid Discord ID for createdById', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: 'any-string-value',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid Discord ID for createdById', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '987654321098765432',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('resourceKey validation', () => {
    it('accepts alphanumeric with underscores', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick_member',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('accepts hyphens', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick-member',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty string', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: '',
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(false);
    });

    it('accepts long keys', async () => {
      const result = await validateDto(CreatePermissionGrantDto, {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'a'.repeat(120),
        effect: 'ALLOW',
        createdById: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('complete validation', () => {
    it('accepts valid permission grant', async () => {
      const validGrant = {
        subjectType: 'ROLE',
        subjectId: '123456789012345678',
        resourceType: 'COMMAND',
        resourceKey: 'kick',
        effect: 'ALLOW',
        createdById: '987654321098765432',
      };

      const result = await validateDto(CreatePermissionGrantDto, validGrant);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(validGrant);
    });
  });
});

describe('PermissionFilterDto', () => {
  it('accepts all optional fields', async () => {
    const result = await validateDto(PermissionFilterDto, {
      subjectType: 'ROLE',
      subjectId: '123456789012345678',
      resourceType: 'COMMAND',
      resourceKey: 'kick',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', async () => {
    const result = await validateDto(PermissionFilterDto, {});
    expect(result.success).toBe(true);
  });

  it('accepts partial filters', async () => {
    const result = await validateDto(PermissionFilterDto, {
      resourceType: 'COMMAND',
    });
    expect(result.success).toBe(true);
  });

  it('validates subject type', async () => {
    const result = await validateDto(PermissionFilterDto, {
      subjectType: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('accepts any string for subjectId', async () => {
    const result = await validateDto(PermissionFilterDto, {
      subjectId: 'any-string',
    });
    expect(result.success).toBe(true);
  });
});
