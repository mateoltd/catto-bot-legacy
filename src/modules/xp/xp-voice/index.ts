/**
 * Voice XP Module
 * Time-based experience and leveling system for voice channels
 */

export * from './types/voice-xp.types.js';
export * from './dtos/index.js';
export * from './utils/index.js';
export * from './repositories/index.js';

// Export only specific services to avoid conflicts with repositories
export { getVoiceLeaderboard, getVoiceUserStats } from './services/voice-xp-leaderboard.service.js';

export {
  calculateVoiceLevel,
  recalculateGuildVoiceLevels,
} from './services/voice-level-calculator.service.js';

export {
  handleVoiceJoin,
  handleVoiceLeave,
  handleVoiceMove,
  handleVoiceStateUpdate,
  awardPerMinuteXP,
} from './services/voice-xp-session.service.js';

export {
  getVoiceXPConfig,
  updateVoiceXPConfig,
  deleteVoiceXPConfig,
  isVoiceXPEnabled,
  clearVoiceConfigCache as clearVoiceXPConfigCache,
} from './services/voice-xp-config.service.js';

export { voiceXPQueue } from './services/voice-xp-queue.service.js';
