/**
 * TypeScript interfaces for API responses
 */

import type { TempVoiceApiError } from '../constants.js';

/**
 * Standardized success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error detail for validation errors
 */
export interface ApiErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Standardized error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: TempVoiceApiError | string;
    message: string;
    details?: ApiErrorDetail[];
    retryAfter?: number;
  };
}

/**
 * Generic API response (success or error)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Validation check result
 */
export interface ValidationCheck {
  field: string;
  valid: boolean;
  message: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
}

/**
 * Config validation response
 */
export interface ConfigValidationResponse {
  valid: boolean;
  checks: ValidationCheck[];
  warnings?: ValidationWarning[];
}

/**
 * Statistics response
 */
export interface TempVoiceStats {
  totalChannelsCreated: number;
  activeChannels: number;
  channelsCreatedToday: number;
  channelsCreatedThisWeek: number;
  channelsCreatedThisMonth: number;
  averageChannelLifetime: number; // in seconds
  mostActiveUsers: Array<{
    userId: string;
    username: string;
    channelsCreated: number;
  }>;
  peakConcurrentChannels: number;
  peakConcurrentTime: Date | null;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}
