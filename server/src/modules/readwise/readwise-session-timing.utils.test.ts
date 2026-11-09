import { describe, expect, it } from 'vitest';

import { computePausedSeconds } from './readwise-session-timing.utils';

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
