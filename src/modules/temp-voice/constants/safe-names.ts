/**
 * Safe name datasets for auto-rename functionality
 * Contains pre-approved words and templates for generating safe channel names
 *
 * Adjectives and nouns are re-exported from the English safe-names set.
 * Other language sets are available via the safe-names-registry.
 */

import { SAFE_ADJECTIVES_EN, SAFE_NOUNS_EN } from './safe-names/safe-names-en.js';

export const SAFE_ADJECTIVES = SAFE_ADJECTIVES_EN;
export const SAFE_NOUNS = SAFE_NOUNS_EN;

/**
 * Pre-made safe templates
 */
export const SAFE_TEMPLATES = [
  'Chat Room',
  'Voice Lounge',
  'Hangout Space',
  'Talk Zone',
  'Community Hub',
  'Group Chat',
  'Voice Channel',
  'Private Room',
  'Team Space',
  'Squad Chat',
  'Casual Hangout',
  'Chill Zone',
  'Gaming Room',
  'Study Session',
  'Music Lounge',
  'Movie Night',
  'Just Chatting',
  'General Voice',
  'Random Talk',
  'Friends Only',
] as const;

/**
 * Themed name sets for specific activities
 */
export const THEMED_NAMES = {
  gaming: [
    'Game Room',
    'Gaming Zone',
    'Player Lounge',
    'Quest Hub',
    'Battle Station',
    'Game Night',
    'Raid Party',
    'Co-op Corner',
    'Arcade Zone',
    'Console Club',
  ],
  study: [
    'Study Room',
    'Study Session',
    'Quiet Study',
    'Focus Zone',
    'Learning Hub',
    'Homework Help',
    'Study Group',
    'Study Spot',
    'Library',
    'Scholar Space',
  ],
  music: [
    'Music Room',
    'Music Lounge',
    'Listening Party',
    'Jam Session',
    'Music Hub',
    'Song Share',
    'Melody Zone',
    'Audio Lounge',
    'Sound Studio',
    'Beat Lab',
  ],
  creative: [
    'Creative Space',
    'Art Room',
    'Studio',
    'Workshop',
    'Brainstorm',
    'Project Hub',
    'Design Studio',
    'Craft Corner',
    'Maker Space',
    'Creator Hub',
  ],
  social: [
    'Social Hub',
    'Hangout',
    'Chill Spot',
    'Coffee Chat',
    'Social Lounge',
    'Friends Zone',
    'Chatting',
    'Talk Time',
    'Social Hour',
    'Catch Up',
  ],
  work: [
    'Work Room',
    'Meeting Room',
    'Office',
    'Workspace',
    'Conference',
    'Team Room',
    'Collaboration',
    'Project Space',
    'Work Session',
    'Professional',
  ],
} as const;

/**
 * Generic fallback templates with number placeholders
 */
export const NUMBERED_TEMPLATES = [
  'Voice Channel #{number}',
  'Room #{number}',
  'Channel {number}',
  'Space {number}',
  'Lounge {number}',
  'Zone #{number}',
] as const;

/**
 * Time-based name templates
 */
export const TIME_BASED_TEMPLATES = [
  '{time} Hangout',
  '{time} Session',
  '{time} Chat',
  '{time} Voice',
] as const;

/**
 * Get time period for time-based templates
 */
export function getTimePeriod(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

/**
 * User count based templates
 */
export const USER_COUNT_TEMPLATES = [
  '{count} Friends',
  'Party of {count}',
  '{count} People',
  '{count} Members',
] as const;

/**
 * Random emoji sets (safe, non-controversial)
 */
export const SAFE_EMOJIS = [
  '🎮',
  '🎵',
  '📚',
  '🎬',
  '🎨',
  '🎭',
  '🎪',
  '🎯',
  '🏆',
  '⭐',
  '💫',
  '✨',
  '🌟',
  '🌙',
  '☀️',
  '🌈',
  '🎉',
  '🎊',
  '🎈',
  '🎁',
  '🏠',
  '🏡',
  '🏰',
  '🏛️',
  '🔥',
  '💎',
  '🎲',
  '🎰',
  '🃏',
  '🎴',
  '🧩',
  '🎼',
] as const;
