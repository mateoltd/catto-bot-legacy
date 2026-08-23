import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { container } from '@sapphire/framework';

// Mock the container.prisma before importing the service
vi.mock('@sapphire/framework', async () => {
  const actual = await vi.importActual('@sapphire/framework');
  return {
    ...actual,
    container: {
      prisma: {
        caseNote: {
          create: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
          count: vi.fn(),
          delete: vi.fn(),
        },
      },
    },
  };
});

import { CaseNoteService } from '#modules/moderation/services/CaseNoteService.js';

describe('CaseNoteService', () => {
  let service: CaseNoteService;

  beforeEach(() => {
    service = new CaseNoteService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('addNote', () => {
    it('should create a case note with all parameters', async () => {
      const mockNote = {
        id: 'note-1',
        caseId: 'case-1',
        guildId: '123456789',
        authorId: '987654321',
        authorTag: 'TestUser#1234',
        content: 'This is a test note',
        createdAt: new Date(),
      };

      vi.mocked(container.prisma.caseNote.create).mockResolvedValue(mockNote);

      const result = await service.addNote({
        caseId: 'case-1',
        guildId: '123456789',
        authorId: '987654321',
        authorTag: 'TestUser#1234',
        content: 'This is a test note',
      });

      expect(container.prisma.caseNote.create).toHaveBeenCalledWith({
        data: {
          caseId: 'case-1',
          guildId: '123456789',
          authorId: '987654321',
          authorTag: 'TestUser#1234',
          content: 'This is a test note',
        },
      });
      expect(result).toEqual(mockNote);
    });
  });

  describe('getNotes', () => {
    it('should return paginated notes with default options', async () => {
      const mockNotes = [
        { id: 'note-1', content: 'Note 1', createdAt: new Date() },
        { id: 'note-2', content: 'Note 2', createdAt: new Date() },
      ];

      vi.mocked(container.prisma.caseNote.findMany).mockResolvedValue(mockNotes as any);
      vi.mocked(container.prisma.caseNote.count).mockResolvedValue(2);

      const result = await service.getNotes('case-1');

      expect(container.prisma.caseNote.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 50,
      });
      expect(result.notes).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should respect page and limit options', async () => {
      vi.mocked(container.prisma.caseNote.findMany).mockResolvedValue([]);
      vi.mocked(container.prisma.caseNote.count).mockResolvedValue(0);

      await service.getNotes('case-1', { page: 2, limit: 10 });

      expect(container.prisma.caseNote.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        orderBy: { createdAt: 'asc' },
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
      });
    });

    it('should clamp limit to maximum of 100', async () => {
      vi.mocked(container.prisma.caseNote.findMany).mockResolvedValue([]);
      vi.mocked(container.prisma.caseNote.count).mockResolvedValue(0);

      await service.getNotes('case-1', { limit: 500 });

      expect(container.prisma.caseNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('should enforce minimum page of 1', async () => {
      vi.mocked(container.prisma.caseNote.findMany).mockResolvedValue([]);
      vi.mocked(container.prisma.caseNote.count).mockResolvedValue(0);

      await service.getNotes('case-1', { page: -5 });

      expect(container.prisma.caseNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });
  });

  describe('deleteNote', () => {
    it('should allow author to delete their own note', async () => {
      const mockNote = {
        id: 'note-1',
        authorId: 'user-123',
        content: 'Test note',
      };

      vi.mocked(container.prisma.caseNote.findUnique).mockResolvedValue(mockNote as any);
      vi.mocked(container.prisma.caseNote.delete).mockResolvedValue(mockNote as any);

      await service.deleteNote('note-1', 'user-123');

      expect(container.prisma.caseNote.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });

    it('should allow admin to delete any note', async () => {
      const mockNote = {
        id: 'note-1',
        authorId: 'user-123', // Different from requester
        content: 'Test note',
      };

      vi.mocked(container.prisma.caseNote.findUnique).mockResolvedValue(mockNote as any);
      vi.mocked(container.prisma.caseNote.delete).mockResolvedValue(mockNote as any);

      // Admin (user-456) deleting user-123's note
      await service.deleteNote('note-1', 'user-456', { isAdmin: true });

      expect(container.prisma.caseNote.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });

    it('should reject deletion by non-author without admin rights', async () => {
      const mockNote = {
        id: 'note-1',
        authorId: 'user-123', // Different from requester
        content: 'Test note',
      };

      vi.mocked(container.prisma.caseNote.findUnique).mockResolvedValue(mockNote as any);

      await expect(service.deleteNote('note-1', 'user-456')).rejects.toThrow(
        'You can only delete your own notes'
      );

      expect(container.prisma.caseNote.delete).not.toHaveBeenCalled();
    });

    it('should reject deletion by non-author when isAdmin is false', async () => {
      const mockNote = {
        id: 'note-1',
        authorId: 'user-123',
        content: 'Test note',
      };

      vi.mocked(container.prisma.caseNote.findUnique).mockResolvedValue(mockNote as any);

      await expect(service.deleteNote('note-1', 'user-456', { isAdmin: false })).rejects.toThrow(
        'You can only delete your own notes'
      );

      expect(container.prisma.caseNote.delete).not.toHaveBeenCalled();
    });

    it('should throw when note does not exist', async () => {
      vi.mocked(container.prisma.caseNote.findUnique).mockResolvedValue(null);

      await expect(service.deleteNote('nonexistent', 'user-123')).rejects.toThrow('Note not found');

      expect(container.prisma.caseNote.delete).not.toHaveBeenCalled();
    });
  });
});
