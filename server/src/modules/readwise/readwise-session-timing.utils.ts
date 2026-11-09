/** Minimal shape needed to work out how much of a session was idle time, not reading time. */
export interface TimedSession {
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  sessionType: string;
}

/**
 * Readwise counts `ended_at - started_at - paused_seconds` as reading time for ebook/paper
 * sessions; `durationSeconds` here is BookOrbit's own active-time measurement, so the gap
 * between the wall-clock span and the active time is what Readwise needs as `paused_seconds`.
 * Audiobook duration is computed by Readwise from the position fields instead, so a listening
 * session never needs (or gets) a `paused_seconds` value.
 *
 * Shared by the push path (`readwise-sessions-push.service.ts`, new sessions) and the
 * correction pass (`readwise-sessions-correction.service.ts`, sessions pushed before this
 * formula existed), so both compute the exact same number for the exact same session.
 */
export function computePausedSeconds(session: TimedSession): number {
  if (session.sessionType === 'listen') return 0;
  const wallClockSeconds = Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000);
  return Math.max(0, wallClockSeconds - session.durationSeconds);
}
