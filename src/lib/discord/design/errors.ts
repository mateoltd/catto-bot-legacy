// Error Types

import { EMOJI as EMOJI } from './emojis.js';

/**
 * Standardized error types for consistent error handling across modules
 */
export type ErrorType =
  | 'PERMISSION_DENIED'
  | 'USER_NOT_FOUND'
  | 'HIERARCHY_ERROR'
  | 'RATE_LIMITED'
  | 'SYSTEM_ERROR'
  | 'VALIDATION_ERROR'
  | 'CONFIG_ERROR'
  | 'NOT_FOUND';

/**
 * Error type to emoji mapping
 */
export const ERROR_ICONS: Record<ErrorType, string> = {
  PERMISSION_DENIED: EMOJI.STATUS.ERROR,
  USER_NOT_FOUND: EMOJI.USER.ICONS.MEMBER,
  HIERARCHY_ERROR: EMOJI.STATUS.WARNING,
  RATE_LIMITED: EMOJI.TIME.CLOCK,
  SYSTEM_ERROR: EMOJI.STATUS.ERROR,
  VALIDATION_ERROR: EMOJI.STATUS.WARNING,
  CONFIG_ERROR: EMOJI.STATUS.WARNING,
  NOT_FOUND: EMOJI.STATUS.WARNING,
};
