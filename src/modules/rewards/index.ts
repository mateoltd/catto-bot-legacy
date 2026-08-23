/**
 * Rewards Module
 * Exports all reward-related services, types, and utilities
 */

// Services
export { RewardService } from './services/RewardService.js';

// Integrations
export { RewardIntegration } from './integrations/RewardIntegration.js';

// Re-export types
export * from '../../lib/types/rewards.types.js';
