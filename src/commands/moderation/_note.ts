import type { Guild, User } from 'discord.js';
import type { CommandResponder } from '#root/lib/discord/index.js';
import { notesService } from '../../modules/moderation/services/NotesService.js';
import { buildNotesList } from '../../modules/moderation/discord/panelBuilder.js';
import { asGuildId, asUserId, asNoteId } from '../../modules/moderation/domain/types.js';
import { errorMessage, successMessage, safeTag } from '#root/lib/discord/index.js';

export interface NoteAddOptions {
  target: User;
  targetId: string;
  content: string;
  tags?: string;
  guild: Guild;
  guildId: string;
  moderator: User;
}

export interface NoteListOptions {
  target: User;
  targetId: string;
  guild: Guild;
  guildId: string;
}

export interface NoteDeleteOptions {
  noteId: string;
  guild: Guild;
  guildId: string;
  moderator: User;
}

export async function handleNoteAdd(options: NoteAddOptions, ctx: CommandResponder) {
  const tags = options.tags
    ? options.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
    : [];

  await ctx.defer();

  try {
    const result = await notesService.addNote({
      guildId: asGuildId(options.guildId),
      userId: asUserId(options.targetId),
      createdById: asUserId(options.moderator.id),
      note: options.content,
      tags,
    });

    if (!result.success) {
      await ctx.editReply(errorMessage('Error', `${result.error}`));
      return;
    }

    const tagsDisplay =
      tags.length > 0 ? `\n**Tags:** ${tags.map((t) => `\`${t}\``).join(', ')}` : '';
    await ctx.editReply(
      successMessage(
        `Note added for **${safeTag(options.target.tag)}**${tagsDisplay}\n**Note ID:** \`${result.noteId}\``
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in note add command:', error);
    await ctx.editReply(
      errorMessage('Error', 'An unexpected error occurred while adding the note.')
    );
  }
}

export async function handleNoteList(options: NoteListOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const notes = await notesService.listNotes(
      asGuildId(options.guildId),
      asUserId(options.targetId)
    );

    const container = buildNotesList(options.target, notes);

    await ctx.editReply(container.build());
  } catch (error) {
    ctx.client.logger.error('Error in note list command:', error);
    await ctx.editReply(errorMessage('Error', 'An unexpected error occurred while listing notes.'));
  }
}

export async function handleNoteDelete(options: NoteDeleteOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    // First get the note to show what was deleted
    const note = await notesService.getNote(asNoteId(options.noteId));

    if (!note) {
      await ctx.editReply(errorMessage('Error', 'Note not found.'));
      return;
    }

    const result = await notesService.deleteNote(
      asNoteId(options.noteId),
      asGuildId(options.guildId)
    );

    if (!result.success) {
      await ctx.editReply(errorMessage('Error', `${result.error}`));
      return;
    }

    await ctx.editReply(
      successMessage(
        `Note \`${options.noteId}\` has been deleted.\n**Preview:** ${note.note.substring(0, 100)}${note.note.length > 100 ? '...' : ''}`
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in note delete command:', error);
    await ctx.editReply(
      errorMessage('Error', 'An unexpected error occurred while deleting the note.')
    );
  }
}
