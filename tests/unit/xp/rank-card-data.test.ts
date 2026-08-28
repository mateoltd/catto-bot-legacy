import { describe, expect, it } from 'vitest';
import {
  calculateRollingDayStreak,
  calculateSessionOverlapMinutes,
} from '#modules/xp/services/rank-card-data.service.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('rank card activity calculations', () => {
  it('counts consecutive rolling activity days without timezone boundaries', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const activity = [
      new Date(now.getTime() - HOUR_MS),
      new Date(now.getTime() - 25 * HOUR_MS),
      new Date(now.getTime() - 49 * HOUR_MS),
      new Date(now.getTime() - 50 * HOUR_MS),
    ];

    expect(calculateRollingDayStreak(activity, now)).toBe(3);
  });

  it('returns zero when the latest activity is outside the current grace window', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    expect(calculateRollingDayStreak([new Date(now.getTime() - 49 * HOUR_MS)], now)).toBe(0);
  });

  it('clips completed sessions to the requested reporting window', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const windowStart = new Date(now.getTime() - 30 * DAY_MS);
    const joinedAt = new Date(now.getTime() - 40 * DAY_MS);
    const leftAt = new Date(now.getTime() - 20 * DAY_MS);

    expect(calculateSessionOverlapMinutes(joinedAt, leftAt, windowStart, now)).toBe(10 * 24 * 60);
  });

  it('clips active sessions at now', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const windowStart = new Date(now.getTime() - 7 * DAY_MS);
    const joinedAt = new Date(now.getTime() - 10 * DAY_MS);

    expect(calculateSessionOverlapMinutes(joinedAt, null, windowStart, now)).toBe(7 * 24 * 60);
  });
});
