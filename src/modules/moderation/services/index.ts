/**
 * Moderation Services
 *
 * This module exports all moderation-related services.
 *
 * ## Core Services (Active)
 * - ModerationService - Core moderation actions (ban, kick, warn, timeout, etc.)
 * - MuteService - Text/voice mute management
 * - MuteScheduler - Scheduled unmute operations
 * - TempbanScheduler - Scheduled unban operations
 * - CaseService - Moderation case management
 * - NotesService - Moderator notes on users
 *
 * ## Extended Services (Retained for future use)
 * These services are implemented but not yet integrated into the UI:
 * - WarningService - Warning escalation system
 * - UserFlagService - User flag/tag management
 * - BulkActionService - Bulk moderation operations
 * - ModerationQueueService - Queued moderation actions
 * - ModEventLogger - Advanced event logging
 * - AppealsService - TODO: Ban/mute appeal handling
 * - CaseTemplateService - Predefined action templates
 *
 * ## Evidence Enhancement Services
 * - AccessLogService - Chain of custody logging (NH-9)
 * - WatermarkService - Download watermarking (NH-8)
 * - AnalyticsService - Evidence analytics (NH-11)
 * - UserProfileService - User moderation profiles (NH-6)
 */

// Core Services
export * from './ModerationService.js';
export * from './MuteService.js';
export * from './DedupService.js';
export * from './MuteScheduler.js';
export * from './TempbanScheduler.js';
export * from './CaseService.js';
export * from './NotesService.js';
export * from './ModEventLogger.js';

// Extended Services (retained for future use)
// export * from './AppealsService.js';
export * from './WarningService.js';
export * from './UserFlagService.js';
export * from './BulkActionService.js';
export * from './ModerationQueueService.js';
export * from './CaseTemplateService.js';

// Evidence Enhancement Services
export * from './AccessLogService.js';
export * from './WatermarkService.js';
export * from './AnalyticsService.js';
export * from './UserProfileService.js';
