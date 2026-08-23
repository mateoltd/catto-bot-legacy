/**
 * Plain Text Response Builders
 *
 * Simple text-based responses for quick replies.
 */

import { type InteractionReplyOptions, type MessageEditOptions, MessageFlags } from 'discord.js';
import { EMOJI } from './design/index.js';

export interface ErrorData {
  type?: string;
  title?: string;
  message: string;
  suggestion?: string;
}

export interface SuccessData {
  title: string;
  details?: Record<string, string>;
  message?: string;
}

export function buildSuccessText(message: string): string {
  return `${EMOJI.STATUS.SUCCESS} ${message}`;
}

export function buildErrorText(message: string): string {
  return `${EMOJI.STATUS.ERROR} ${message}`;
}

export function buildWarningText(message: string): string {
  return `${EMOJI.STATUS.WARNING} ${message}`;
}

export function buildInfoText(message: string): string {
  return `${EMOJI.STATUS.INFO} ${message}`;
}

export function ephemeralError(message: string): InteractionReplyOptions {
  return {
    content: buildErrorText(message),
    flags: MessageFlags.Ephemeral,
  };
}

export function ephemeralSuccess(message: string): InteractionReplyOptions {
  return {
    content: buildSuccessText(message),
    flags: MessageFlags.Ephemeral,
  };
}

export function editError(message: string): MessageEditOptions {
  return { content: buildErrorText(message) };
}

export function editSuccess(message: string): MessageEditOptions {
  return { content: buildSuccessText(message) };
}
