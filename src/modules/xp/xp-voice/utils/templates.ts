/**
 * Voice XP Template Parsing
 */

import type { VoiceTemplateVariables } from '../types/voice-xp.types.js';

/**
 * Parse template with voice-specific variables
 */
export function parseVoiceTemplate(template: string, variables: VoiceTemplateVariables): string {
  let result = template;

  result = result.replace(/{user}/g, variables.user);
  result = result.replace(/{userId}/g, variables.userId);
  result = result.replace(/{username}/g, variables.username);
  result = result.replace(/{level}/g, variables.level.toString());
  result = result.replace(/{xpGain}/g, variables.xpGain.toString());
  result = result.replace(/{totalXp}/g, variables.totalXp.toString());
  result = result.replace(/{minutesInVoice}/g, variables.minutesInVoice.toString());
  result = result.replace(/{nextLevelXp}/g, variables.nextLevelXp.toString());
  result = result.replace(/{progress}/g, variables.progress.toFixed(1));
  result = result.replace(/{type}/g, variables.type);

  return result;
}

/**
 * Format time duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
