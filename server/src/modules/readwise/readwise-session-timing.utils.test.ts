import { describe, expect, it } from 'vitest';

import { computePausedSeconds, isSessionSettled, settleAtFor } from './readwise-session-timing.utils';

describe('computePausedSeconds', () => {
  it('returns the idle gap for an ebook session that was open longer than it was active', () => {
    const seconds = computePausedSeconds({
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T01:00:00Z'),
      durationSeconds: 1200,
      sessionType: 'read',
    });
    expect(seconds).toBe(2400);
  });

  it('returns 0 when active time matches the wall-clock span exactly', () => {
    const seconds = computePausedSeconds({
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T00:10:00Z'),
      durationSeconds: 600,
      sessionType: 'read',
    });
    expect(seconds).toBe(0);
  });

  it('never goes negative when active time slightly exceeds the wall-clock span (rounding)', () => {
    const seconds = computePausedSeconds({
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T00:10:00.400Z'),
      durationSeconds: 601,
      sessionType: 'read',
    });
    expect(seconds).toBe(0);
  });

  it('always returns 0 for a listening session, regardless of the idle gap', () => {
    const seconds = computePausedSeconds({
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T01:00:00Z'),
      durationSeconds: 1200,
      sessionType: 'listen',
    });
    expect(seconds).toBe(0);
  });
});

describe('isSessionSettled', () => {
  const endedAt = new Date('2026-01-01T12:00:00Z');
  const minutesLater = (minutes: number) => new Date(endedAt.getTime() + minutes * 60_000);

  it('holds a web, Android or iOS session until it has been quiet for 10 minutes', () => {
    for (const source of ['web', 'android', 'ios', null]) {
      expect(isSessionSettled({ source, endedAt }, minutesLater(9))).toBe(false);
      expect(isSessionSettled({ source, endedAt }, minutesLater(10))).toBe(true);
    }
  });

  it('holds a koreader session until it has been quiet for 30 minutes', () => {
    expect(isSessionSettled({ source: 'koreader', endedAt }, minutesLater(29))).toBe(false);
    expect(isSessionSettled({ source: 'koreader', endedAt }, minutesLater(30))).toBe(true);
    expect(settleAtFor({ source: 'koreader', endedAt })).toEqual(minutesLater(30));
  });
});
