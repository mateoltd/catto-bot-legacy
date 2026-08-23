import { container } from '@sapphire/framework';
import type { GuildId, UserId, NoteId, ModNoteInput } from '../domain/types.js';
import { asNoteId } from '../domain/types.js';

/**
 * Service result type for notes operations
 */
export interface NoteResult {
  success: boolean;
  noteId?: NoteId;
  error?: string;
}

/**
 * Note data returned from queries
 */
export interface NoteData {
  id: NoteId;
  guildId: string;
  userId: string;
  createdById: string;
  note: string;
  tags: string[];
  createdAt: Date;
}

/**
 * NotesService - Handles moderator notes on users
 */
export class NotesService {
  /**
   * Add a note to a user
   */
  async addNote(input: ModNoteInput): Promise<NoteResult> {
    try {
      const note = await container.prisma.userModNote.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          createdById: input.createdById,
          note: input.note,
          tags: input.tags ?? [],
        },
      });

      return { success: true, noteId: asNoteId(note.id) };
    } catch (error) {
      container.logger.error('Failed to create note:', error);
      return { success: false, error: 'Failed to create note' };
    }
  }

  /**
   * List all notes for a user in a guild
   */
  async listNotes(guildId: GuildId, userId: UserId): Promise<NoteData[]> {
    const notes = await container.prisma.userModNote.findMany({
      where: {
        guildId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => ({
      id: asNoteId(note.id),
      guildId: note.guildId,
      userId: note.userId,
      createdById: note.createdById,
      note: note.note,
      tags: note.tags,
      createdAt: note.createdAt,
    }));
  }

  /**
   * Get a single note by ID
   */
  async getNote(noteId: NoteId): Promise<NoteData | null> {
    const note = await container.prisma.userModNote.findUnique({
      where: { id: noteId },
    });

    if (!note) return null;

    return {
      id: asNoteId(note.id),
      guildId: note.guildId,
      userId: note.userId,
      createdById: note.createdById,
      note: note.note,
      tags: note.tags,
      createdAt: note.createdAt,
    };
  }

  /**
   * Delete a note by ID
   */
  async deleteNote(noteId: NoteId, guildId: GuildId): Promise<NoteResult> {
    try {
      const note = await container.prisma.userModNote.findUnique({
        where: { id: noteId },
      });

      if (!note) {
        return { success: false, error: 'Note not found' };
      }

      if (note.guildId !== guildId) {
        return { success: false, error: 'Note does not belong to this guild' };
      }

      await container.prisma.userModNote.delete({
        where: { id: noteId },
      });

      return { success: true, noteId };
    } catch (error) {
      container.logger.error('Failed to delete note:', error);
      return { success: false, error: 'Failed to delete note' };
    }
  }

  /**
   * Get notes count for a user in a guild
   */
  async getNotesCount(guildId: GuildId, userId: UserId): Promise<number> {
    return container.prisma.userModNote.count({
      where: { guildId, userId },
    });
  }

  /**
   * Search notes by tag
   */
  async searchByTag(guildId: GuildId, tag: string): Promise<NoteData[]> {
    const notes = await container.prisma.userModNote.findMany({
      where: {
        guildId,
        tags: { has: tag },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => ({
      id: asNoteId(note.id),
      guildId: note.guildId,
      userId: note.userId,
      createdById: note.createdById,
      note: note.note,
      tags: note.tags,
      createdAt: note.createdAt,
    }));
  }
}

// Export singleton instance
export const notesService = new NotesService();
