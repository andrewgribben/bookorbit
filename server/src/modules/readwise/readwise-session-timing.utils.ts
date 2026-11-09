import { READWISE_KOREADER_SETTLE_GAP_SECONDS, READWISE_SESSION_SETTLE_GAP_SECONDS } from './readwise.constants';

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

/** Minimal shape needed to decide whether a koreader session could still grow on a later upload. */
export interface SettleCheckSession {
  source: string | null;
  endedAt: Date;
}

/**
 * A koreader session is clustered from page-stat uploads with a gap rule
 * (`KOREADER_SESSION_GAP_SECONDS` in `koreader-stats.util.ts`, mirrored here as
 * `settleGapSeconds` since modules don't import each other's internals): a later upload within
 * that gap of the session's current `endedAt` extends the same row instead of starting a new
 * one. So a koreader session has only truly finished growing once that gap has elapsed since it
 * last ended. Other sources checkpoint open sessions and supersede them later, so they wait
 * for READWISE_SESSION_SETTLE_GAP_SECONDS of quiet, matching the readers' 10-minute session gap.
 */
export function settleAtFor(session: SettleCheckSession): Date {
  const gapSeconds = session.source === 'koreader' ? READWISE_KOREADER_SETTLE_GAP_SECONDS : READWISE_SESSION_SETTLE_GAP_SECONDS;
  return new Date(session.endedAt.getTime() + gapSeconds * 1000);
}

export function isSessionSettled(session: SettleCheckSession, now: Date = new Date()): boolean {
  return now.getTime() >= settleAtFor(session).getTime();
}
