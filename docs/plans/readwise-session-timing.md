# Plan: accurate reading-session durations to Readwise

## Summary (read this first)

Readwise shows the right days but wrong durations for Iron Gold because **BookOrbit never
sends Readwise the one field that tells it to subtract idle time**. Readwise's session
duration formula is `ended_at - started_at - paused_seconds` (confirmed from
https://readwise.io/books_api). BookOrbit's push code sends `started_at`/`ended_at` as the
session's real wall-clock span but leaves `paused_seconds` unset
(`readwise-sessions-push.service.ts:27-48`), even though the field is already declared on the
client type (`readwise-books-client.service.ts:106`). Readwise therefore counts the full
wall-clock span, including any time the app was backgrounded, as reading time.

This is compounded by a second, separate bug: both the web reader and the Android app treat
"backgrounded for hours, then resumed" as the **same session continuing**, not a new one. So a
single BookOrbit session can legitimately span a start-of-day read and an evening read with one
`startedAt`...`endedAt` pair, and today nothing downstream (not even BookOrbit's own UI) splits
it.

Fixing just the `paused_seconds` gap is a small, low-risk change and should be done regardless.
Fixing the session-splitting behaviour (the owner's "pause on sleep, new session after a long
gap" idea) is a bigger change across web, Android and the server, detailed below.

## Confirmed findings (with file:line)

**How a session is recorded today**

- Web reader: `client/src/features/reader/shared/composables/useReadingSession.ts`
  - Tracks `activeMs` (active time only) separately from `startedAt`/`endedAt` (wall clock).
  - `IDLE_TIMEOUT_MS = 5 * 60 * 1000` (line 11): if no `onActivity()` call for 5 minutes *while
    visible*, the session ends (line 91, `resetIdleTimer` → `endSession`).
  - `onVisibilityChange` (lines 163-169): on `hidden`, calls `pauseTimer()`, which also
    **clears the idle timer** (line 80, `clearIdleTimer()` inside `pauseTimer`). On becoming
    visible again, `resumeTimer()` (lines 83-87) just resumes the *same* session, however long
    it was hidden.
  - Net effect: locking the phone/switching tabs for minutes or hours never ends the session by
    itself; only idle-while-visible, `beforeunload`, or component unmount do. `durationSeconds`
    sent to the server is active time only (line 140), but `startedAt`/`endedAt` span the whole
    gap.
- Android: `app/src/main/java/com/bookorbit/feature/sessions/ReadingSessionRecorder.kt` and
  `ReadingSessionTracker.kt` (bookorbit-android repo).
  - `ReadingSessionRecorder.accrue()` (lines 110-114) only counts time while `activeSince` is
    set; `setActive(false, ...)` (line 76) stops accrual exactly at the transition.
  - `ReadingSessionTracker.onForeground(false)` (lines 116-122) sets the recorder inactive and
    **checkpoints** (sends the partial session) but does not call `endLocked()` — the session
    stays open under the same `sessionId`/`startedAtMs` (confirmed: `endLocked()` is only called
    from `end()`, `beginReading()` on a new file, and the listen path's idle-close branch).
    There is no reading-side equivalent of `LISTEN_IDLE_CLOSE_MS` (line 199) that would close a
    reading session after a long background gap.
  - Listening (audiobook) does have an explicit gap rule: `LISTEN_IDLE_CLOSE_MS = 10 * 60_000L`
    (line 199) closes the session if paused that long before the next `onListening`/`setActive`.
- Server, manual save path: `server/src/modules/reading-session/reading-session.service.ts:37-117`
  (`save()`). Line 62: `wallClockSeconds = endedAt - startedAt`. Line 66:
  `durationSeconds = min(dto.durationSeconds, wallClockSeconds)` — the server trusts whatever
  active-time number the client computed, only capping it, never reconstructing it.
- Server, dedupe/checkpoint-supersede: `reading-session.repository.ts:144-281` (`saveSession`).
  Same `sessionId` re-saved with a larger duration **updates** the row upward only (lines
  198-243); this is deliberate (iOS app backgrounding/termination checkpoints, see comment at
  lines 200-212) and is unrelated to the Readwise gap.
- Server, KOReader/Kobo cumulative counters: `reading-session.repository.ts:283-407`
  (`recordCumulativeSyncedSession`). These devices push a monotonic minute counter, not
  start/end timestamps; BookOrbit derives `startedAt = endedAt - durationSeconds` (line 357) from
  the counter delta minus whatever was already measured by a "real" session
  (`measuredSecondsInWindow`, lines 46-59). This path is a different mechanism from the
  web/Android active-timer path and is not implicated in the Iron Gold web/app mismatch, but it
  feeds the same `reading_sessions` table and the same Readwise push.
- Migration `0141_add_readwise_session_source.sql`: adds `'readwise'` to the
  `reading_sessions_source_chk` check constraint — this is for **pulled-back** sessions
  (`source = 'readwise'`), not the push path.

**What is actually sent to Readwise**

- `server/src/modules/readwise/readwise-sessions-push.service.ts:27-48` (`toCreateItem`):
  builds `{ book_id, started_at: session.startedAt, ended_at: session.endedAt, format,
  timezone, publish_to_feed, percent_at_start/end or position_seconds_at_start/end }`.
  **`paused_seconds` is never set**, and `session.durationSeconds` (the field that holds active
  time, from `PushableSession` in `readwise-sessions-local.repository.ts:11-20`) is read nowhere
  in this function.
- `server/src/modules/readwise/readwise-books-client.service.ts:102-116`:
  `ReadwiseCreateSessionItem` already declares `paused_seconds?: number` — the field exists on
  the BookOrbit side, it's just never populated.
- Pull side evidence this is the right read of the model:
  `readwise-sessions-local.repository.ts:194` computes the *local* mirror duration for a
  Readwise-originated session as `endedAt - startedAt` with no `paused_seconds` term, i.e.
  BookOrbit's own pull path assumes Readwise's `ended_at`/`started_at` are the only durable
  record once a session round-trips — reinforcing that `paused_seconds` has to be right at push
  time, because it isn't preserved/returned for BookOrbit to reconcile against later anyway
  (confirm against the actual `GET /sessions` response fields during implementation — Readwise's
  doc example for a created session does include `paused_seconds` and `total_time_seconds` in
  the response, so a future pull-side improvement could read it back).

## Readwise's session model (from https://readwise.io/books_api)

- `POST /books/api/v1/sessions`, 1-10 items per request, rate limit 50/minute.
- Required/relevant fields per session item: `book_id`, `started_at`, `ended_at`, `format`
  (`ebook`/`audiobook`/`paper`), plus position fields for that format
  (`percent_at_start/end` for ebook, `page_at_start/end` for paper,
  `seconds_at_start/end` for audiobook), `timezone`, optional `publish_to_feed`,
  optional **`paused_seconds`** (integer, seconds to subtract).
- **Duration formula, stated explicitly in the docs:** "Reading time is `ended_at` -
  `started_at` - `paused_seconds`. For `audiobook`, it is `seconds_at_end` - `seconds_at_start`."
  This confirms the root-cause hypothesis above as close to a fact as the public docs allow —
  audiobook duration doesn't use `paused_seconds` at all, it's purely position-delta based.
- **Not deduped.** A repeated `POST /sessions` with identical data creates a second session
  every time (doc: "Sessions have no such match: a repeated `POST /sessions` records a second
  session"). This matches the existing handover note in
  `docs/HANDOVER-reading-services.md:92-95` ("Readwise does not dedupe sessions") and the
  defensive comment already in `readwise-sessions-push.service.ts:50-60` about batch failures
  needing per-item retry rather than resending the whole batch blindly.
  **Any backfill/correction work must not re-POST sessions that already have a ledger link.**
- **Sessions can be corrected or removed after the fact.** `PATCH /books/api/v1/sessions` takes
  `{"items": [{"id": ..., ...fields to change}]}`; `DELETE` takes ids in the query string
  (`?ids=`), never a body. Both are documented under "Updates and deletes" in the same page.
  BookOrbit already stores the Readwise `session_id` for every pushed session in
  `reading_service_item_links` (`provider='readwise', kind='session'`,
  `readwise-sessions-push.service.ts:185-199`), so a correction pass has the id it needs without
  re-deriving anything.
- Session reads: `GET /books/api/v1/sessions` supports `updated_after` sync and
  `include_deleted`; a session's own `caption` is feed-only metadata, not part of the session
  record proper.

## Design: active-reading timer with pause/idle/gap rules

### 2a. Client-side timer behaviour (web + Android), same shape on both platforms

1. **Active clock**: accrues wall-clock time only while the app is visible/foregrounded *and*
   there has been a recent reading signal (page turn, scroll, tap, TTS progress tick, audio
   playing). This already exists on both platforms (`activeMs` / `accruedMs`); keep it.
2. **Pause on hide**: screen off, app backgrounded, or tab hidden stops the active clock
   immediately (already correct on both platforms via `visibilitychange` /
   `ProcessLifecycleOwner`).
3. **Idle threshold** (tolerate short glances away): if no reading signal arrives for N minutes
   *while still visible/foreground*, pause the clock and start the session-gap clock (see 4).
   Today this is `IDLE_TIMEOUT_MS = 5 min` on web and implicit (no reading-side equivalent) on
   Android — Android needs this added for symmetry with its own `LISTEN_IDLE_CLOSE_MS` pattern.
4. **Session-gap rule** (this is the missing piece): track how long the clock has been paused,
   whether because of hide or idle. If the gap exceeds a threshold **M** (proposed default 30
   minutes, open decision below), the *next* reading signal starts a brand-new session
   (`sessionId`, fresh `startedAt`) instead of resuming the old one. If the gap is under **M**,
   resume the same session as today.
   - Web: change `onVisibilityChange`'s hidden branch to also start/refresh a "paused-since"
     timestamp, and `onActivity`'s resume branch to check that timestamp against **M** before
     deciding `resumeTimer()` vs starting a new session (today it always resumes, see
     `useReadingSession.ts:163-169` and `:101-111`).
   - Android: same idea in `ReadingSessionTracker.onForeground(false)` /
     `ReadingSessionRecorder.setActive` — record the inactive timestamp (already captured via
     `inactiveSince`, line 38/78) and have the *next* `beginReading`/`onReadingProgress` call
     check `inactiveForMs()` against **M** before reusing `recorder.key`, mirroring the listen
     path's existing `LISTEN_IDLE_CLOSE_MS` check at `ReadingSessionTracker.kt:78,93-97`.
5. **What gets sent is unchanged in shape**: `sessionId`, `startedAt`, `endedAt`,
   `durationSeconds` (active time), `progressDelta`, `endProgress`. The server-side cap
   (`durationSeconds <= endedAt - startedAt`) stays as a safety net.

### 2b. Server-side: carry the idle/paused time through to Readwise

6. Add a `pausedSeconds` (or reuse `endedAt - startedAt - durationSeconds`, computed, no new
   column needed) at push time: in `toCreateItem()`
   (`readwise-sessions-push.service.ts:27-48`), set
   `item.paused_seconds = Math.max(0, wallClockSeconds - session.durationSeconds)` for
   `format === 'ebook'`/`'paper'`. Skip it for `audiobook` sessions, since Readwise ignores
   `paused_seconds` for that format and computes duration from `seconds_at_start/end` instead —
   so audiobook accuracy depends entirely on `position_seconds_at_start/end` being right, which
   they already are (lines 39-41).
   - This alone fixes the reported mismatch for any *future* push, with no schema change, no
     client change, and no new idle/gap logic. **Ship this first regardless of the rest of the
     plan** (see staging below).
7. No Drizzle schema change is required for step 6 (it's derived at push time from existing
   columns). The session-gap rule in 2a doesn't need a schema change either — a "new session"
   is just a new row with a new `sessionId`/`startedAt`, exactly like today's behaviour when a
   session legitimately ends. If later analytics need to see "this session was split because of
   a N-minute gap" as a distinct fact, that would need a new nullable column on
   `reading_sessions` (e.g. `splitReason`), generated via `pnpm db:generate` — not needed for the
   initial fix.

### 2c. Audiobook / TTS listening

- Android's listen path already has pause-on-stop and an idle-close gap rule
  (`LISTEN_IDLE_CLOSE_MS`, 10 min) — bring reading in line with it rather than inventing a new
  mechanism (step 4 above literally mirrors it).
- Web's TTS path (`client/src/features/tts/composables/useTtsReadingSession.ts`) was not
  inspected in depth for this plan; check at implementation time whether it reuses
  `useReadingSession.ts` (likely, given the shared `sessionType` plumbing in
  `reading-session.service.ts:41`) or has its own pause/idle logic that needs the same gap rule.

### 2d. Backfill/correction of already-pushed sessions

8. For sessions already pushed to Readwise with the old (wrong) mapping: use the stored
   `reading_service_item_links` (`provider='readwise', kind='session'`) to find the Readwise
   `session_id` for each affected local `reading_sessions` row, then `PATCH /sessions` with the
   corrected `paused_seconds` for each one. This is a bounded, resumable batch job (same shape
   as existing push/pull services — paginate by local session id, bounded batch size, log
   `[start]/[end]/[fail]` per the studio's logging convention).
9. **Do not re-POST.** Given Readwise's no-dedupe behaviour, any correction must go through
   `PATCH`, never `POST`, for sessions that already have a ledger link. New (never-pushed)
   sessions still go through `POST` as today.
10. This correction pass only fixes `paused_seconds`/duration. It does nothing for the deeper
    "one session spanned two actual reading occasions" problem for *historical* sessions — there
    is no way to retroactively know where the gap was inside an already-recorded session's
    `startedAt`/`endedAt` span unless BookOrbit kept finer-grained activity timestamps (it
    doesn't). That's a one-time accuracy ceiling for the backlog; only sessions recorded *after*
    the client-side gap fix (2a) will be correctly split going forward.

### 2e. Multi-device overlap, privacy, scale

- Multi-device overlap (e.g. reading the same book on web and Android at once) is already
  handled by `sourceDeviceKey`-scoped cumulative counters for KOReader/Kobo
  (`reading-session.repository.ts:110-124`), and by the fact that each client generates its own
  `sessionId` — two devices reading concurrently simply produce two overlapping
  `reading_sessions` rows, which both get pushed to Readwise as separate sessions (correct,
  since the person genuinely spent that time on each device, even if concurrent). No change
  needed here; flag to the owner only if double-counted duration across devices during the same
  wall-clock window turns out to matter for stats (it would also have existed before this plan).
- Privacy: no new data leaves the device/server boundary — `paused_seconds` is derived
  server-side from numbers already stored (`durationSeconds`, `startedAt`, `endedAt`); no new
  client telemetry (e.g. raw page-turn timestamps) needs to be sent to the server to implement
  this plan's session-gap rule, since the client only needs to decide locally whether to reuse
  or roll a new `sessionId`.
- Scale: all push/backfill queries are already user+book scoped and paginated
  (`findPushableSessions`, `findAllPushableSessions` in
  `readwise-sessions-local.repository.ts:45-136`, both bounded by `limit`). The backfill job in
  2d must follow the same pattern (bounded batches, resumable by last-processed id), consistent
  with `AGENTS.md`'s scale rules.

## Open decisions for the owner

1. **Session-gap threshold M** (gap after which resuming counts as a new session instead of the
   same one). Proposed default: 30 minutes. The owner's "hours later = new session" and "seconds
   = same session" are both satisfied by a wide range of values; 30 minutes is a reasonable
   middle but is genuinely a judgement call.
2. **Idle-while-visible threshold** for reading (currently 5 minutes on web, step 3). Keep as-is,
   shorten, or lengthen? Also: should Android's reading path get an explicit idle timer
   (currently it has none — only explicit foreground/background transitions stop the clock), or
   is foreground/background enough there since phones rarely stay foregrounded-but-idle for long?
3. **Backfill scope**: should the correction pass (2d) run automatically for every historical
   Readwise-linked session, or only for a bounded recent window (e.g. last 90 days), or only on
   explicit owner request per book? Automatic correction changes numbers on the owner's Readwise
   dashboard retroactively, which the owner may or may not want without being asked each time.
4. **Audiobook/TTS sessions**: confirm whether the owner has noticed the same mismatch for
   audiobook listening (which uses `position_seconds_at_start/end`, not `paused_seconds`) — if
   listening durations are fine today, that narrows the fix to ebook/paper only and de-risks step
   6.
5. Should the `publish_to_feed` (social) behaviour change at all as part of this work? Not
   requested, flagging only because `toCreateItem` already threads `publishToFeed` through the
   same function being touched in step 6.

## Staged delivery

**Stage 1 — server only, small, do first.** Populate `paused_seconds` in
`toCreateItem()` for ebook/paper sessions (step 6). Add/extend unit tests in
`readwise-sessions-push.service.test.ts` asserting the mapped item's `paused_seconds` for a
session where `durationSeconds < wallClockSeconds`. No client change, no migration. Fixes all
*future* pushes immediately. Rough size: half a day including tests.

**Stage 2 — backfill/correction job, server only.** New scheduled or on-demand service that
walks `reading_service_item_links` for `provider='readwise', kind='session'`, recomputes
`paused_seconds` for the linked local session, and `PATCH`es Readwise. Needs the owner's answer
to open decision 3 before scoping. Rough size: 1-2 days including a dry-run/report mode so the
owner can see what would change before it runs for real.

**Stage 3 — web client session-gap rule.** Implement the idle/paused-since tracking and the
new-session-vs-resume decision in `useReadingSession.ts` (step 4). Add/extend
`useReadingSession.spec.ts` covering: short hide-then-resume (same session), long
hide-then-resume (new session), idle-while-visible beyond threshold (new session). Rough size:
1 day including tests.

**Stage 4 — Android session-gap rule.** Mirror stage 3 in `ReadingSessionRecorder`/
`ReadingSessionTracker`, reusing the existing `inactiveSince`/`LISTEN_IDLE_CLOSE_MS` pattern for
the reading path. Add/extend `ReadingSessionRecorderTest.kt`. Rough size: 1 day including tests,
done by whoever owns the Android repo (separate repo from this one).

**Stage 5 — owner validation.** After stage 1 is live, owner re-checks a few days of Iron Gold
sessions in Readwise against their own sense of how long they actually read, before committing
to stages 2-4.

## Test plan

- Unit: `readwise-sessions-push.service.test.ts` — `paused_seconds` present and correct for
  ebook/paper, absent for audiobook, zero when `durationSeconds == wallClockSeconds`.
- Unit: new backfill service tests — dry-run report matches expected diffs; `PATCH` only ever
  called for sessions with an existing ledger link; never calls `POST`.
- Unit (web): `useReadingSession.spec.ts` — gap under M resumes same `sessionId`/`startedAt`;
  gap over M starts a new session on the next activity; idle-while-visible beyond the idle
  threshold behaves the same as today (ends/starts fresh).
- Unit (Android): `ReadingSessionRecorderTest.kt` — same three cases as above, mirroring the
  existing `ReadingSessionTracker` listen-path tests' style.
- Manual/owner: after stage 1 ships, owner compares a few real Iron Gold sessions in Readwise
  against actual reading time for a few days before approving stages 2-4.
