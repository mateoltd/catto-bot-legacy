/**
 * Shared Types for DCB
 */

import type { User, ContainerBuilder, EmbedBuilder } from 'discord.js';

export type UIResponse = ContainerBuilder | EmbedBuilder;

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}

export interface SortOptions<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

export interface UserDisplayData {
  id: string;
  tag: string;
  avatarURL?: string | null;
  displayName?: string;
}

export function getUserDisplayData(user: User): UserDisplayData {
  return {
    id: user.id,
    tag: user.tag,
    avatarURL: user.displayAvatarURL(),
    displayName: user.displayName,
  };
}

export type TimestampFormat = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

export function createTimestamp(date: Date, format: TimestampFormat = 'f'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
}

export interface InteractionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: string;
}

export interface DeferredReplyState {
  isDeferred: boolean;
  isEphemeral: boolean;
}
