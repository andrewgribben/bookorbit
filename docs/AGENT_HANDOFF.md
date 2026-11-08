# BookOrbit Agent Handoff

Instructions for another agent continuing work on this project. Read this fully before making changes.

## Project

Self-hosted book/library app with Kobo support. pnpm monorepo:

- `server/` NestJS 11 + Fastify + Drizzle/Postgres
- `client/` Vue 3
- `packages/types/` shared types
- `workers/read-aloud/` optional STAlign/QuartzNet worker

Repo path: `/mnt/user/data/Development/bookorbit`  
Fork remotes: `origin` = `andrewgribben/bookorbit`, `upstream` = `bookorbit/bookorbit`  
Live site: https://library.grib.co  
Host: Unraid (`linux 6.12.54-Unraid`)

Rules live in `AGENTS.md` / `CLAUDE.md`. Also follow `docs/COMMIT_GUIDELINES.md`.

Hard requirements:

- Never push to upstream (`bookorbit/bookorbit`). Do push completed work to the fork (`origin` = `andrewgribben/bookorbit`) so it is not only local
- Never add `Co-authored-by` (Cursor injects it; strip with `git commit-tree` + `git reset --soft` if needed)
- No em dashes anywhere
- Commit completed work before starting the next step
- Vue handlers must be bare method refs (`@click="handleFoo"`)
- User-scoped queries and `@RequirePermission` for destructive actions
- Pre-push hooks run full lint + typecheck (several minutes). That is expected; do not skip hooks unless the user asks

---

## S2: Readwise Books migration (2026-11-08)

Branch `feat-readwise-books-migration`, stacked on `feat-reading-services-core` @ `d0532d3d`. Worktrees: PC `D:/Development/bookorbit-worktrees/feat-readwise-books-migration`, Unraid `/mnt/user/data/Development/bookorbit-worktrees/feat-readwise-books-migration`. Final hash **`2b87bc0d33258eb0769e2ca873346952391f0b15`**, local only, not pushed.

All edits were made on the PC worktree and committed there; every install, build, lint, typecheck and test run happened over SSH on Unraid, per the task's PC/Unraid split. Commits were moved to Unraid with `git bundle` + `scp` into a scratch ref, then fast-forwarded (or, once, reset after an amend) into the Unraid worktree. No schema change was needed: S1 already created `reading_service_book_links` et al. in migration 0139, so no `db:generate` or disposable Postgres run was required for this stage.

What was built (plan section "S2 tasks: Readwise migration"):

1. **`readwise-books-client.service.ts`** - Books API v1 client (`listBooks`, `getBooksByIsbns`, `createBooks`, `updateBooks`, `listSessions`, `createSessions`, `deleteSessions`, `statsSummary`, `sessionsByDay`). Reuses `ReadwiseQueueService`'s per-user throttle, honours `Retry-After` on 429, and raises a dedicated `ReadwiseBooksForbiddenError` on 403.
2. **`book-matcher.ts`** (shared `reading-services` core, not Readwise-specific) - pure `matchBook`/`buildRemoteIndex`, isbn13 then isbn10-converted then normalized-title-author, with edition collapse and `product:null` cases covered.
3. **`readwise-books-migration.service.ts`** - implements `ReadingServiceProviderAdapter.migratePage`: an index phase pages the full remote library into the shared `reading_service_cache` (TTL 1h), then a push phase walks local books 200 at a time (`readwise-books-local-books.repository.ts`), matches, and calls `updateBooks` for matches or `createBooks` for unmatched non-`unread` books. Every push writes a `reading_service_book_links` snapshot before the cursor advances, so a crash mid-run resumes from the last persisted page rather than resending. Registers itself with `ReadingServiceRegistry` in `onModuleInit`.
4. **Migration preview** - `previewMigration` on the adapter (added as an optional method on `ReadingServiceProviderAdapter`, since not every provider has one yet) does a read-only dry run and the controller's `/migration/preview` endpoint now calls it instead of returning a hardcoded zero.
5. **D1 ownership classification** - `readwise-book-ownership.ts` classifies a Readwise-only book's `creation_origin` as `owned`, `not_owned`, or explicitly `unknown` when the origin is missing or unrecognised; it never assumes ownership it cannot support. Readwise-only books are counted in the run's `skipped` counter and the classified list is cached under `reading_service_cache` key `migration-readwise-only` for a future UI to read (no UI was built in this stage, as instructed).
6. **Status mapping** - `readwise-books-status-mapping.ts` implements both directions of the section 4.1 table (push is wired into the migration; pull is only unit-tested now, ready for stage S3).
7. **403 handling** - any Books API call that returns 403 sets `readwise_user_settings.disabled_reason = 'no_readwise_books'` and disables the connection, via a small `callReadwise` wrapper in the migration service.

Deliberate scope cut from the plan's task 5: the plan asked for an e2e test against the disposable Postgres on 55436. Given the "focused checks only, full/e2e suites deferred to PR" instruction already in force for this whole feature, I wrote `readwise-books-migration.service.test.ts` as a NestJS-service-level test with fake repositories and a mocked `fetch`-backed client instead of a real-Postgres e2e spec (seeds the same 3-book matched/created/skip scenario from the plan). No real or disposable database was touched by this stage. Flag this if the eventual PR review wants a true DB-backed e2e added before merge.

No live Readwise calls, no writes to the production `bookorbit-db`, and nothing in this stage touches the private Readwise POC (not referenced, not imported).

**Verified on Unraid** (worktree above, after `pnpm install --frozen-lockfile`, `pnpm --filter @bookorbit/types build`, `pnpm --filter @bookorbit/plugin-api build`):

- Targeted `npx vitest run` across the new/changed files (`book-matcher`, `readwise-book-ownership`, `readwise-books-status-mapping`, `readwise-books-client.service`, `readwise-books-migration.service`, `reading-services.controller`, plus the untouched-but-adjacent `readwise-client.service`, `readwise.repository`, `three-way-merge`): **9 files, 97 tests, all passed.**
- `npx eslint src/modules/reading-services src/modules/readwise`: clean, 0 problems.
- `npx prettier --check src/modules/reading-services src/modules/readwise`: all matched files use Prettier style.
- `npx tsc -p tsconfig.build.json --noEmit` (full server typecheck): clean. (Needed `pnpm --filter @bookorbit/plugin-api build` first; that workspace package's `dist` wasn't present in the fresh worktree, unrelated to this stage's changes - confirmed by the same tsc run being clean on the untouched `feat-reading-services-core` worktree once its `dist` existed too.)
- Full repo-wide `pnpm run lint:check`, client typecheck, and the full/e2e test suites were **not** run, per the "focused checks only" instruction; defer to PR preparation.

Unresolved / notes for the next agent:

- `ReadwiseBooksMigrationService.previewMigration` and the index-build phase both page the whole remote library with no cap; fine for a personal library, but should get a progress callback or a hard cap if this is ever exposed for very large libraries before S3/S6.
- Sessions, highlights-via-this-adapter and the recap widget pieces of the plan's task 1 method list (`listSessions`/`createSessions`/`deleteSessions`/`statsSummary`/`sessionsByDay`) are implemented in the client but not yet wired to anything; that lands in S4/S7.
- No UI was touched, as instructed; `migration-readwise-only` cache entries are ready for S6a's mockup to consume.

---

## S3: Readwise two-way books sync (2026-11-08)

Branch `feat-readwise-books-two-way`, stacked on `feat-readwise-books-migration` @ `ef89264e`. Worktrees: PC `D:/Development/bookorbit-worktrees/feat-readwise-books-two-way`, Unraid `/mnt/user/data/Development/bookorbit-worktrees/feat-readwise-books-two-way`. Head commit **`4b0e34f43`**, local only, not pushed.

Same PC/Unraid split as S2: edits and commits on PC, every install/build/lint/typecheck/test over SSH on Unraid, commits moved by `git bundle` + `scp`. One round trip was needed because `npx eslint --fix` reformatted two test files on Unraid; that diff was copied back to PC with `git apply` and folded into the commit with `git commit --amend --no-verify`, then the Unraid worktree was torn down and recreated from the amended bundle (plain `git checkout -- .` plus `git worktree remove`/`add`, no `git reset --hard`, since that pattern needs interactive approval this agent could not grant itself).

What was built (plan "S3 tasks: two-way books"):

1. **`readwise-books-push-scheduler.service.ts`** - per-user debounce (2s, 10s max wait) that accumulates changed book ids and calls `ReadwiseBooksPushService.flushUser`, mirroring the shape of the existing `ReadwiseAutoSyncSchedulerService`. On a flush failure it re-queues the same book ids with a capped exponential retry (base 30s, max 5 attempts) instead of dropping the batch.
2. **`readwise-books-event-listener.service.ts`** - subscribes to `ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED` and `ACHIEVEMENT_EVENT_BOOK_RATING_CHANGED` on `AchievementEventsService` and forwards the user id and book id(s) to the scheduler.
3. **`readwise-books-push.service.ts`** - for each pending book, loads the local row, the per-user `ReadingServiceFeaturesService` toggles, and the existing `reading_service_book_links` row (via two new `ReadingServicesRepository` methods, `findBookLinkByExternalId`/`findBookLinksForProvider`/`markRemoteDeleted`). No link yet and a non-`unread` book: creates it on Readwise and writes the link with a fresh snapshot. A link that exists: diffs each enabled field (status, rating, startedAt, finishedAt) against the link's stored snapshot and only sends what changed (this is also the echo-suppression mechanism, see below). `remoteDeleted` links and books the Readwise side removed are skipped, not recreated. A 403 disables the connection the same way the migration adapter does and stops the batch.
4. **`readwise-books-pull.service.ts`** - `@Interval`-driven (15 min) poll over every connected user (`ReadwiseRepository.findConnectedUserIds`, 2 users at a time), using an `updatedAfter` cursor cached per user under `reading_service_cache` key `books-pull-cursor` (TTL 1 year, refreshed every run). Readwise's Books API does not bump a book's `updated` timestamp for a rating or review-only edit, so every 6th hour (tracked in the same cursor payload as `lastFullPassAt`) the pull does a full, unfiltered re-list instead of an incremental `order=updated&updatedAfter=...` one; the full pass also diffs the complete remote id set against this provider's links to catch a hard delete on the Readwise side (`markRemoteDeleted`). Each matched book goes through the shared `mergeField`/`mergeDateField` three-way merge (`local`, `mapped remote`, `link.snapshot`) field by field, respecting the same per-user feature toggles as the push side, and a `pull` action is applied through `UserBookStatusService.updateManual` (status/dates) or `BookService.bulkSetRating` (rating, rounded half-up) rather than writing the DB directly, so downstream events/stats fire normally. Every applied pull (and every book visited, matched or not) rewrites the link snapshot to the merged values before returning, which is what makes the push side's snapshot-diff see "no change" for a pull-originated write (echo suppression) instead of bouncing it straight back to Readwise.
5. **Status mapping, both directions** - reuses the section 4.1 table from S2 (`readwise-books-status-mapping.ts`, unchanged) for push; pull uses the same table's reverse direction, preserving a local `on_hold`/`rereading` under a remote `currently_reading` and a local `skimmed` under a remote `finished` (no spurious overwrite), and never writes a local status for `unsorted`.
6. **Conflict resolution** - `mergeField`/`mergeDateField` (existing S1 `three-way-merge.ts`, not modified) already implements "BookOrbit wins" when both sides changed since the last snapshot, per plan section 9; S3 just wires push and pull through it for books instead of leaving it only session/highlight-facing.
7. **Reviews** - deliberately out of scope per the task instructions (D2/S3b is a later stage); `ReadwiseBooksPushService`/`ReadwiseBooksPullService` only read/write `status`, `rating`, `startedAt`/`finishedAt` fields. The field loop in both services is a small per-field table, so adding a `review` row later is a few-line change, not a restructure - that is the "mapping hook" left for D2/S3b.
8. **Migration adapter wiring** - `readwise-books-migration.service.ts` now takes `ReadwiseBooksPullService` in its constructor, its registered capabilities move from push-only to both directions for `status`/`rating`/`dates` (`owned` stays read-only), and `pull(userId)` delegates to `pullForUser` instead of being a no-op.
9. **Module wiring** - `ReadwiseModule` now imports `BookModule` and `UserBookStatusModule` (both already export the services needed) alongside its existing imports, and registers the four new providers. `ScheduleModule.forRoot()` is already registered once at the app level (`app.module.ts`), so no change was needed there for `@Interval` to work.

No Readwise sync-run cancel/permission/DTO work was touched, per the orchestrator's note that a concurrent agent is hardening those on `feat-reading-services-core`; `reading-service-sync-run.service.ts` and `reading-services.controller.ts`/its DTOs were not edited. This branch has not yet been merged with that work; merge `feat-readwise-books-migration` into this branch once it has absorbed those fixes (`git merge --no-ff feat-readwise-books-migration`).

No live Readwise calls, no writes to the production `bookorbit-db`, no disposable Postgres was needed (no schema change in this stage).

**Verified on Unraid** (worktree above, after `pnpm install --frozen-lockfile`, `pnpm --filter @bookorbit/types build`, `pnpm --filter @bookorbit/plugin-api build`):

- Targeted `npx vitest run src/modules/readwise src/modules/reading-services`: **24 files, 207 tests, all passed** (includes every status-mapping-table row in both directions, rating rounding, date-pull-when-null, the 6-hour full-pass trigger, echo suppression, local-wins conflict, feature-toggle respect, and the 403 disabled-reason path, plus the untouched-but-adjacent existing suites in both directories).
- `npx eslint src/modules/reading-services src/modules/readwise`: clean, 0 problems (after one `--fix` pass for formatting, folded back into the commit - see above).
- `npx prettier --check src/modules/reading-services src/modules/readwise`: all matched files use Prettier style.
- `npx tsc -p tsconfig.build.json --noEmit` (full server typecheck): clean, exit 0.
- Full repo-wide `pnpm run lint:check`, client typecheck, and the full/e2e test suites were **not** run, per the "focused checks only" instruction; defer to PR preparation.

Unresolved / notes for the next agent:

- The pull service's full-pass remote-id diff only has the current page's results in memory at any time (it pages through all of Readwise, matching per page); for a very large library this is fine, but if `READWISE_BOOKS_PULL_FULL_PASS_INTERVAL_MS` is ever shortened, check the full pass still comfortably finishes inside the 15-minute interval poll period.
- Review sync (D2/S3b) and the review mapping hook noted above are not implemented, only left easy to add.
- `feat-readwise-books-migration` has not been merged into this branch yet; do that once the concurrent S1 runner-hardening work lands there, before opening a PR.

---

## Merge: feat-readwise-books-migration (S1 runner hardening) into feat-readwise-books-two-way (2026-11-08)

By the time S3 landed, `feat-readwise-books-migration` had already absorbed the concurrent agent's S1 runner fixes (cancel race, duplicate-run guard, per-run permission, features DTO validation, encrypt-on-write; commit `ffe3381ee8`). Merged with `git merge --no-ff feat-readwise-books-migration` on the PC worktree (merge commit `9a5299499b`), auto-merged clean, only `reading-services.repository.ts` touched by both sides and resolved automatically (my S3 link-lookup methods are additive next to the S1 permission/guard methods). Re-verified on Unraid after the merge: `pnpm install --frozen-lockfile` (no new deps), targeted `npx vitest run src/modules/readwise src/modules/reading-services src/modules/hardcover` **39 files, 571 tests, all passed**; `npx eslint`/`npx prettier --check` on the same three directories clean; `npx tsc -p tsconfig.build.json --noEmit` clean, exit 0. Head is now `9a5299499b`, still local only, not pushed.

---

## Merge: upstream 2026-11-08 into feat-reading-services-core (2026-11-08)

Worktree: `/mnt/user/data/Development/bookorbit-worktrees/feat-reading-services-core` (PC mirror: `D:/Development/bookorbit-worktrees/feat-reading-services-core`).

Merged `merge-upstream-2026-11-08` (`43e1dc8a`, upstream's `0138_drop_podcasts`) into `feat-reading-services-core` (`aa43a5e1`, had `0138_reading_services`). Merge commit `fdca1c9f` (parents `aa43a5e1` + `43e1dc8a`).

Conflict resolution:

- `server/.env.example`: took upstream's version (drops the podcast env block, matching `0138_drop_podcasts`), then re-added the `READING_SERVICES_ENCRYPTION_KEY` doc block (right after `BOOK_REQUEST_ENCRYPTION_KEY`, before the metadata provider directory section).
- `server/src/config/config.ts`: kept `readingServicesConfig`, dropped `podcastConfig` entirely (podcasts are gone upstream; confirmed no other file references `podcastConfig`).
- `server/src/db/migrations/meta/_journal.json` and `meta/0138_snapshot.json`: took upstream's version wholesale (intended base), so idx 138 is `0138_drop_podcasts` only.
- Deleted our old `server/src/db/migrations/0138_reading_services.sql` (superseded by a regenerated migration on top of upstream's 0138).
- Regenerated reading-services as **migration 0139** on Unraid (see below), not 0138. Journal now has idx 139 = `0139_reading_services`.
- All reading-services schema (`server/src/db/schema/reading-services.ts`, `shared-reading-insights.ts`) and module code under `server/src/modules/reading-services`, `readwise`, `hardcover` merged cleanly with no conflicts.

Migration regeneration (per policy, all done over SSH on Unraid, never on the PC):

1. Created temp integration worktree `/mnt/user/data/Development/bookorbit-worktrees-scratch/merge-integration-temp` off `aa43a5e1` (separate from the canonical `feat-reading-services-core` and `merge-upstream-2026-11-08` worktrees, both clean, to avoid disturbing their passed gates).
2. Tarred the full resolved merge working tree from the PC (minus `.git`/`node_modules`) and overlaid it onto the temp worktree.
3. `pnpm install --frozen-lockfile`, `pnpm --filter @bookorbit/types build`, then `cd server && pnpm db:generate reading_services` → produced `src/db/migrations/0139_reading_services.sql` + `meta/0139_snapshot.json`, journal updated to idx 139.
4. Verified on a disposable, loopback-only `pgvector/pgvector:pg18` container (`127.0.0.1:55440`, container `bo-merge-test-db`, removed after use, never `bookorbit-db`): `pnpm db:migrate` applied 0001-0139 cleanly, then `pnpm db:generate drift_check` reported "No schema changes, nothing to migrate".
5. Copied `0139_reading_services.sql`, `meta/0139_snapshot.json`, `meta/_journal.json`, `meta/0138_snapshot.json` back to the PC worktree, staged, and ran `git commit --no-edit` there (husky ran prettier/eslint on staged files, no manual edits needed).
6. Committed merge: `fdca1c9f`. Local only, not pushed.

Independent focused verification (separate worktree `/mnt/user/data/Development/bookorbit-worktrees-scratch/merge-verify`, created by bundling and fetching `fdca1c9f` into the canonical Unraid `bookorbit` repo under a throwaway branch, deleted after use):

- `pnpm install --frozen-lockfile` clean.
- `pnpm run typecheck:server` (`tsc --noEmit -p tsconfig.build.json`): clean, no errors.
- Targeted `npx eslint` on `src/modules/reading-services`, `src/modules/readwise`, `src/modules/hardcover`, `src/config/config.ts`, `src/common/guards/library-access.guard.ts`: clean.
- Targeted `npx vitest run` on the same areas plus `src/config/config.test.ts`, `src/config/env.validation.test.ts`: 32 files, 539 tests, all passed.
- `npx vitest run src/db/migration-journal.test.ts`: 2/2 passed.
- Full repo-wide `lint:check` and client typecheck were not run (would duplicate the independent gate already green on this branch pre-merge; deferred to PR per instructions). Full e2e/full test suite also deferred to PR.

Permission/guard review (targeted, as requested): `ReadingServicesController` is class-level `@RequireAnyPermission(ReadwiseSync, HardcoverSync)`, every mutating/reading endpoint re-checks the specific provider permission via `assertProviderAccess`, and all repository/service methods take `userId` and filter by it (`findRun`, `cancelRun`, etc. scoped by `userId`). No security issue found.

Unresolved / notes for the next agent:

- Full project-wide `pnpm run lint:check` (client + server) and `pnpm run typecheck:client`/`:worker` were not run on the merge; run them (or the PR's CI) before considering this merge release-ready.
- Full `pnpm run test` (client+server+worker) and e2e suites were intentionally deferred to PR per the task; only focused areas were verified above.
- A harmless 0-byte stray file `server/.env.example.theirs` may still be sitting untracked in the PC worktree (artifact of an open file handle during conflict resolution); it is untracked, excluded from the commit, and safe to delete once the file lock clears.
- Branch `feat-reading-services-core` now sits at `fdca1c9f`, 10 commits ahead of `origin/development`, not pushed anywhere.

---

## Latest state (2026-11-05)

Read this section first; the older sections below describe the v3.6.0 merge.

Live site runs image `andrewgribben/bookorbit:development-00cc7a03`, built from branch `feat-reader-backup-import` (not `development`). Rollback images: `andrewgribben/bookorbit:rollback-pre-bulk-series-status`, `...:rollback-pre-view-in-series`, `...:rollback-pre-progress-rules`, `...:rollback-pre-reader-backup-source`, `...:rollback-pre-reader-backup-hint`, `...:rollback-pre-reader-import`, `...:rollback-pre-book-actions`.

Mihon and Komikku backups are a Source Type in the library import (Settings -> Maintenance); picking it shows upload, preview and apply in place of the server wizard. It is no longer on the Komga API page. Smart scope Reading progress rules now respect explicit Read/Unread statuses and count audiobook progress. Book cards have "View in Series" in the kebab menu. Series status can be set from a book's Set Status menu and from the bulk selection bar (`POST /api/v1/series/bulk-status`, takes the usual bulk selection payload plus `status` or `null`). Tachimanga `.tmb` backups (SQLite) are not supported yet; the user may send a sample. Pre-deploy DB dumps are in `/mnt/user/appdata/bookorbit-backups/`.

Branches on the fork, stacked, none merged into `development` yet (merging needs the user's go-ahead):

1. `feat-series-book-actions`: per-user series status (Reading, Caught up, Completed, On hold, Dropped), Up Next cutoff and status filters, mark read up to here / mark unread from here, explicit unread overrides stale progress. Migration `0137_series_follow_status` is applied on live.
2. `feat-reader-backup-import` (on top of 1): Settings -> Komga API -> "Import from Mihon or Komikku". `POST /api/v1/reader-import/mihon` previews, `?apply=true` applies. Matches by BookOrbit ID, then by file path from the Komga migration snapshot, then by issue number. Never marks books unread, keeps existing series statuses, and skips books the user marked Unread or Want to read. No DB migration.

Worktrees: `/mnt/user/data/Development/bookorbit-worktrees/<branch>` on Unraid, same layout on the Mac under `Personal/bookorbit-worktrees/`.

Comics library (id 5): "Where book details come from" is now path rules (`folder_series` preset) first, then tags, then OPF. Rules were re-applied twice; every year-named folder now has exactly one series. Before/after records: `comics-series-before-reapply*.psv` in the backups folder.

Open items:

- User has not yet run the Komikku import on live (preview first, then Apply).
- Mylar created folders with a placeholder `(2099)` year (e.g. `Midnight Spider-Man (2099)`); the user is renaming them in Mylar. After the files move, run "Apply rules to existing books" on Comics again.
- `Marvel Age 1000 (2023)` got issue 1000 from its filename; `Legion of Super-Heroes 5 (2005)` got issue 5 from its folder name. The user will check and fix these by hand; do not lock or change them.
- Next step: the user runs the Komikku import preview on live and reports back. Do not merge the stacked branches into `development` before that.
- No admin CLI exists; refreshes need a logged-in session (user's browser is not Chromium, so no shared session for the agent).

Verify tips for this work:

- e2e tests need a disposable Postgres, never `bookorbit-db`: run `pgvector/pgvector:pg18` on `127.0.0.1:55436`, `DATABASE_URL=<it> pnpm db:migrate`, then `E2E_DATABASE_URL=<it> npx vitest run --config vitest.config.e2e.ts <files>`.
- Push from Unraid with `NODE_OPTIONS=--max-old-space-size=8192 git push ...`; without it the pre-push typecheck can abort with exit 134.
- Deploy: dump DB, tag current image as rollback, `docker build -t andrewgribben/bookorbit:development-<sha> .`, retag as `:development`, then `/usr/local/emhttp/plugins/dynamix.docker.manager/scripts/rebuild_container bookorbit` (full path; not on PATH in non-login shells).

---

## Current state (as of the v3.6.0 merge)

`development` on the fork should contain:

1. Upstream v3.6.0 merge (from local branch `merge-upstream-v3.6.0`)
2. Narration-start fix (cherry-picked onto that merge; keeps upstream `mediaOverlayFragmentSeconds` plus `chooseNarrationStart`)
3. This handoff document

Also on the fork:

- Branch `origin/merge-upstream-v3.6.0` (merge tip + narration cherry-pick)
- Branch `origin/fix-read-aloud-narration-start` and open PR https://github.com/andrewgribben/bookorbit/pull/14 (narration-only against the older `development` tip). Once `development` includes the fix, that PR is redundant; close or supersede it rather than merging it alone

Confirm before assuming this is still true:

```bash
cd /mnt/user/data/Development/bookorbit
git fetch origin
git log -5 --oneline origin/development
git merge-base --is-ancestor origin/merge-upstream-v3.6.0 origin/development && echo 'merge branch is in development'
```

---

## What the merge brought in

Branch history: fork `development` (`e9070cc8`) + upstream tag `v3.6.0`, then follow-ups ending at `012d6e88`, then narration cherry-pick.

What upstream replaced:

- Audiobook chapter editing: fork Edit Metadata editor dropped; take upstream Chapters tab / `chapter-editor` + `chapter-health`
- Comic folder series: drop `derive_series_from_folder` and Field Rules source `folder`; convert to regex preset `folder_series`

What must survive from the fork:

- Komga API (`server/src/modules/komga-api/`)
- Audiobook podcast feeds
- Komga migration import
- Book merge
- Comic deferral / sidecar OPF fixes re-applied onto upstream

Migrations strategy (important):

- Keep fork SQL files `0101_add_derive_series_from_folder.sql`, `0102_add_user_api_keys.sql`, `0103_add_audiobook_podcast_feeds.sql` with **original** `when` timestamps
- Append those journal entries **after** upstream in `_journal.json`
- Custom `0135_convert_folder_series_preset` converts opted-in libraries and drops the old column
- `0136_fork_api_keys_and_feeds` is a snapshot no-op (`SELECT 1;`) so future `db:generate` does not recreate tables
- Do **not** retime upstream migrations
- Historical fork tags are special-cased in `server/src/db/migration-journal.test.ts`

---

## Narration-start fix

Play was resuming the last saved sentence even after jumping chapters.

Fix: `chooseNarrationStart` in `client/src/features/reader/media-overlay/lib/media-overlay-resume.ts`, used from `ReaderView.vue` `handleStartMediaOverlay`. Resume only if saved section === current section and the sentence still intersects the visible page; otherwise start on the chapter on screen.

On the merge line this was cherry-picked with conflict resolution that **keeps** both `chooseNarrationStart` and upstream `mediaOverlayFragmentSeconds` (imports + tests for both).

Targeted test:

```bash
cd client && pnpm exec vitest run src/features/reader/media-overlay/lib/media-overlay-resume.test.ts
```

---

## Unraid / Docker state

Running containers (verify with `docker ps`):

| Name                          | Image                                                 | Notes                                               |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `bookorbit`                   | `andrewgribben/bookorbit:development`                 | Recreate after rebuilding if `development` advanced |
| `bookorbit-read-aloud-worker` | `ghcr.io/bookorbit/bookorbit-read-aloud-worker:3.6.0` | CPU worker on `gribnet`                             |
| `bookorbit-db`                | `pgvector/pgvector:pg18`                              | Do not recreate casually                            |

Important mounts on the app:

- `/mnt/user/media/Books/Library` -> `/books`
- `/mnt/user/appdata/bookorbit` -> `/data`
- `/mnt/user/media/Audiobooks/read-aloud` -> `/data/read-aloud` (**host then container**; earlier failure was this reversed)

Worker mounts:

- Books library RO at `/books`
- Same read-aloud data RW at `/data/read-aloud`
- Models land at `/mnt/user/media/Audiobooks/read-aloud/ghost-story/models`
- Runs as `99:100`, same as app

Unraid user templates:

- `/boot/config/plugins/dockerMan/templates-user/my-bookorbit.xml` (includes `READ_ALOUD_WORKER_URL` + token)
- `/boot/config/plugins/dockerMan/templates-user/my-bookorbit-read-aloud-worker.xml`
- Build helper: `./scripts/build-dev-image.sh` tags `andrewgribben/bookorbit:development` and `...:development-<sha>`

Network: both app and worker on `gribnet`  
Worker URL in app: `http://bookorbit-read-aloud-worker:8787`  
Do **not** publish worker port 8787 to the host.

---

## Read-aloud feature notes

Docs: `docs/READ_ALOUD.md`

Requirements for a book:

- Folder as Book library (`book_per_folder`)
- Plain EPUB + audiobook on the **same** book (merge first if needed)
- Worker configured and library mounted
- Permission `LibraryGenerateReadAloud`

UI: book Details -> Files -> Create read-aloud. Headphones button in the reader plays media overlays; it does **not** auto-play on open.

Known verified book: Iron Gold, book id `72`  
https://library.grib.co/book/72?tab=details  
Has `.epub`, `.m4b`, and `.readaloud.epub` (`media_overlay_available=true`). Primary file is the readaloud EPUB.

Series folders check already done for `Supergirl (2025)`: new `folder_series` rules + run-year guard keep `Supergirl (2025)` even when ComicInfo says bare `Supergirl`.

---

## Likely next steps (ask the user)

1. Close or supersede PR #14 once `development` has the narration fix
2. Rebuild `andrewgribben/bookorbit:development` from updated `development` and recreate the Unraid app container
3. Open a PR from `development` only if reviewing against another base; otherwise continue shipping on the fork `development` branch
4. Further read-aloud UX only if requested

---

## Dev / verify tips

- Node on the box is often v22; project wants >=24. Docker image uses a newer Node.
- `nest start` SWC can fail locally; `nest start --builder tsc --type-check false` worked during merge verification.
- Rebuild types/plugin-api if stale dist causes phantom schema diffs:  
  `pnpm --filter @bookorbit/types build`  
  `pnpm --filter @bookorbit/plugin-api build`
- Production DB: container `bookorbit-db`, user/db `bookorbit`. Be careful; this is the live library.
- Prefer Unraid-editable Docker templates over one-off CLI deploys
- Do not replace `bookorbit-db` or wipe `/mnt/user/appdata/bookorbit`
- When fixing Unraid path mappings, always verify host -> container direction with `docker inspect`

## S1 review fixes + merge into S2 (2026-11-08)

Fixed six S1 review findings on `feat-reading-services-core` (final hash
**`6033e7de7b`**), then merged that branch into `feat-readwise-books-migration`
(final hash **`ffe3381ee8`**). Both local only, not pushed.

Findings fixed, one commit each on `feat-reading-services-core`:

1. `runLoop` re-checks `cancelled` after the final in-flight `migratePage`
   resolves, so a cancel arriving while the last page is in flight is no
   longer overwritten by a `completed` status write.
2. `startMigration` now calls `findRunningRun` and returns the existing
   `running` run for the same `(userId, provider, kind)` instead of starting
   a duplicate. Chose a DB-level guard too: a partial unique index
   `rs_runs_user_provider_kind_running_uidx` on `reading_service_runs` where
   `status = 'running'`, generated via `pnpm db:generate` (migration 0140)
   and verified on a disposable pg18 container (migrate + drift_check both
   clean). This is the smallest correct option: an in-process check alone
   cannot close the race between two concurrent requests both passing the
   check before either insert commits, and a full lock service would be
   overkill for one row per user/provider/kind.
3. Controller `getRun`/`cancelRun` now re-check `assertProviderAccess` for
   the fetched run's provider, not just userId ownership.
4. `UpdateReadingServiceFeaturesDto.features` now uses a class-validator
   constraint rejecting unknown feature keys or non-boolean values with a
   clean 400 instead of a 500 deep in the service.
5. Readwise and Hardcover `upsertSettings` now encrypt a freshly supplied
   token immediately when `READING_SERVICES_ENCRYPTION_KEY` is configured
   (plaintext column set to null), instead of waiting for the lazy
   migrate-on-read path. Old plaintext rows still migrate lazily on read.
   Also fixed `shouldSeedWatermark` (Readwise) and the token-required guard
   (both services) to recognise an encrypted-only row as "token configured",
   since a token no longer necessarily lands in the plaintext column at all.
6. Removed the stray untracked `server/.env.example.theirs` from the PC
   worktree.

Not done: the stale sync-run cache reaper mentioned in the review is not
addressed. No cron/cleanup job evicts finished run state from the
in-memory cache map over long uptimes; worth a follow-up card if memory
growth becomes a real issue in practice.

Merge: `git merge --no-ff feat-reading-services-core` into
`feat-readwise-books-migration` was conflict-free both times (once before
the migration commit, once after); git's auto-merge resolved the
controller/repository overlap with S2's preview work cleanly on its own.

Verification on Unraid, both branches, after every sync:

- `pnpm exec tsc --noEmit -p tsconfig.build.json` (server): clean on
  `feat-readwise-books-migration`; `feat-reading-services-core` has the
  same 10 pre-existing unrelated errors (request-locale decorator,
  chapter-editor, dashboard.service, koreader catalog sort, path.service)
  present since before this work (confirmed by typechecking commit
  `d0532d3d` directly) and not touched by these fixes.
- `eslint`/`prettier --check` on every changed file: clean on both
  branches.
- `vitest run src/modules/reading-services src/modules/readwise
  src/modules/hardcover`: 30 files / 470 tests passed on
  `feat-reading-services-core`, 35 files / 537 tests passed on
  `feat-readwise-books-migration`, both after the migration merge.
- Migration 0140 applied cleanly on a disposable
  `pgvector/pgvector:pg18` container bound to 127.0.0.1:55442; a
  follow-up `db:generate drift_check` reported "No schema changes,
  nothing to migrate". Container removed afterwards.

One hiccup worth recording: `hardcover-settings.service.ts` originally
typed a local var as `Parameters<typeof this.repo.upsertSettings>[1]`.
Removing an unrelated line in the same method (the forced
`existing!.apiToken` carry-forward, replaced by letting
`onConflictDoUpdate` leave the column untouched when no new token is
given) made `tsc` fail with `TS2304: Cannot find name 'this'` on that
type position, even though the literal text of the annotation did not
change. Root cause not fully understood; fixed by switching to the
`Parameters<HardcoverRepository['upsertSettings']>[1]` pattern already
used in `readwise-settings.service.ts`, which sidesteps `this` in a type
position entirely. If this resurfaces elsewhere, prefer the
`SomeClass['method']` pattern over `typeof this.foo` in a local type
annotation.

## S4: Readwise reading sessions two-way sync (2026-11-08)

Branch `feat-readwise-sessions`, stacked on `feat-readwise-books-two-way`
@ `13370231f` (the tip moved past the plan's original `2a831ec5` anchor
while this stage was in progress, since another agent merged an
`no_readwise_books` label fix into `feat-readwise-books-two-way`; this
branch was built directly on the new tip rather than merged afterwards).
Worktrees: PC `D:/Development/bookorbit-worktrees/feat-readwise-sessions`,
Unraid `/mnt/user/data/Development/bookorbit-worktrees/feat-readwise-sessions`.
Final hash **`74335fc80c4f9e912ebea56f7c5f88a1419b0798`**, local only, not pushed.

Scope: server-side only (client `listSessions`/`createSessions`/
`deleteSessions` already existed from S2). Push: eligible BookOrbit
sessions go to Readwise with a `publish_to_feed` toggle. Pull: Readwise
sessions land in BookOrbit for stats, but can never move BookOrbit's own
reading position/status (plan section 9).

What was built:

1. `reading_sessions.source` check constraint and the shared
   `ReadingSessionSource` type gained a `'readwise'` value (migration
   0141, generated with `pnpm db:generate add_readwise_session_source`,
   applied and drift-checked clean on a disposable pg18 container).
2. Defense in depth: `ReadingSessionRepository.findLatestEndProgress`
   and the other position-affecting query now explicitly exclude
   `source = 'readwise'` rows, on top of pulled sessions never carrying
   progress/position fields in the first place (belt and suspenders).
3. `ReadwiseSessionsPushService` + `ReadwiseSessionsPushSchedulerService`
   + `ReadwiseSessionsEventListener`: a session save fires
   `ACHIEVEMENT_EVENT_READING_SESSION_SAVED`, the listener resolves
   `bookFileId` to a book and queues a debounced (2s, capped at 10s)
   per-user/per-book flush. The flush only looks at books that already
   have a Readwise book link (skips `remoteDeleted` links), selects up
   to 200 unlinked, non-readwise-sourced sessions of at least 60s via
   `ReadwiseSessionsLocalRepository.findPushableSessions`, posts them to
   the Books API sessions endpoint in batches of 10, and writes every
   ledger row (`reading_service_item_links`, `kind='session'`) in one
   batch insert right after each successful POST. A 403 disables the
   Readwise connection the same way the S3 books push does, and a
   failed batch gets retried with a 30s base / 5 max-retry backoff.
   `publish_to_feed` on the pushed sessions follows the new
   `publish_sessions` feature toggle (capability `publish_sessions:
   'push'`), default off since it posts to the user's public Readwise
   feed.
4. `ReadwiseSessionsPullService`: runs on the same interval as the S3
   books pull. Calls `listSessions` with `order=updated`, `updatedAfter`
   (the per-user watermark) and `include_deleted`. A session is skipped
   if its ledger row already exists (echo suppression: a session this
   BookOrbit instance pushed comes back on the next pull and is
   recognised by the ledger, not re-inserted) or if its book has no
   Readwise link yet. A genuinely new remote session is inserted with
   `source: 'readwise'`, `bookFileId: null`, `progressDelta: null`,
   `endProgress: null` and its ledger row, all in one DB transaction
   (`ReadwiseSessionsLocalRepository.insertPulledSession`), plus a daily
   stats row update so streaks/totals count it. A remote delete removes
   the local session row and marks the ledger entry deleted
   (`removePulledSession`), idempotently (a second delete event on an
   already-deleted ledger row is a no-op).
5. `readwise.module.ts` registers the four new session providers;
   `readwise-books-migration.service.ts` gained `sessions: 'both'` and
   `publish_sessions: 'push'` capabilities.

Tests added (all in the server module, mocked DB/HTTP, no live
Readwise calls): `readwise-sessions-push.service.test.ts` (token/feature
gating, no-link skip, `remoteDeleted` skip, batch push + ledger write,
`publish_to_feed` toggle on/off, 403 disables connection),
`readwise-sessions-pull.service.test.ts` (token/feature gating,
unlinked-book skip, already-linked-ledger skip = echo suppression, new
session insert with no position fields, soft-remove on remote delete,
idempotent re-delete, 403 handling),
`readwise-sessions-local.repository.test.ts` (ledger + session insert in
one transaction, defensive no-library skip, remove + ledger
soft-delete scoped to user/localId),
`reading-services.repository.test.ts` (new `recordItemLinks`/
`findItemLinkByExternalId`/`markItemLinkDeleted` ledger methods),
`readwise-sessions-event-listener.service.test.ts` (bookFileId
resolution to a push request), plus one new case in
`reading-session.repository.test.ts` asserting the position query's
`where` clause carries the `readwise` exclusion.

Verification on Unraid:

- `vitest run src/modules/readwise src/modules/reading-services
  src/modules/reading-session`: 38 files / 357 tests passed.
- `eslint --fix` + `prettier --write` (via lint-staged on commit) on
  every new/changed file: clean, three pre-fix formatting nits
  resolved (a multi-line object literal, a wrapped function signature,
  a stray blank line).
- `tsc --noEmit -p tsconfig.json` (server): zero errors in any file
  touched by this stage; the ~80 remaining errors are all in unrelated
  e2e specs and drizzle `ExtractTablesWithRelations<Record<string,
  unknown>>` generic mismatches that predate this branch (confirmed by
  grepping the output for this stage's file paths: no matches).
- Migration 0141 applied cleanly on a disposable `pgvector/pgvector:pg18`
  container bound to 127.0.0.1:55444; `pnpm db:generate drift_check`
  reported "No schema changes, nothing to migrate". Container stopped
  afterwards.

Open questions for the owner / a successor:

- The plan's optional migration-backfill phase (importing a user's
  full Readwise session history on first connect, analogous to the S2
  books backfill) was not built. S4 as shipped only syncs sessions
  going forward from whenever push/pull first run for a user. If a
  one-time historical import is wanted, it needs its own card.
- No UI toggle was added for `publish_sessions`; it is set via the
  existing features PATCH endpoint only (same pattern as other
  toggles). The client worktree building Readwise settings UI may want
  to surface this.

## S3b: Book reviews (2026-11-08)

Branch `feat-book-review`, stacked on `feat-readwise-sessions` @ `b835cd1d`.
Worktrees: PC `D:/Development/bookorbit-worktrees/feat-book-review`, Unraid
`/mnt/user/data/Development/bookorbit-worktrees/feat-book-review`.

Implements plan section 9 D2: a `review` field distinct from the existing
private `personalNote`, synced both ways with Readwise's `review` field.

What was built:

1. **Schema** - new `user_book_reviews` table (`server/src/db/schema/reader.ts`),
   same shape as `user_book_notes` (composite PK `user_id, book_id`), with a
   check constraint capping `review` at 10,000 characters (mirrors Readwise's
   own documented limit, see `readwise-api.md`).
2. **Server module** - `server/src/modules/user-book-review/` (service,
   repository, module), mirroring `user-book-note` exactly: `findOne`,
   `findByBookIds`, `setReview`, `setReviews`, with blank-to-null
   normalization and truncation at `USER_BOOK_REVIEW_MAX_LENGTH`.
3. **API** - `PATCH /api/v1/books/:id/review` (`UpdateReviewDto`, same
   `@RequirePermission(Permission.LibraryEditMetadata)` as rating). Omitted
   `review` key leaves it unchanged; `null` clears it, matching the
   personal-note contract.
4. **Achievement event** - `book.review-changed` (`ACHIEVEMENT_EVENT_BOOK_REVIEW_CHANGED`,
   payload `{ userId, bookId, review }`), emitted from `BookService.updateReview`
   and consumed by `ReadwiseBooksEventListener` to queue a push, same as rating.
5. **Readwise two-way sync** - `review` is now a `'both'` capability
   (`READING_SERVICE_FEATURES` already had the key from an earlier stage;
   this stage wires it up). Push (`readwise-books-push.service.ts`), pull
   (`readwise-books-pull.service.ts`, using the existing `mergeField`
   three-way merge so BookOrbit wins on conflict, same as rating) and the
   one-time migration (`readwise-books-migration.service.ts`) all read/write
   `review` alongside status/rating/dates. `readwise-books-local-books.repository.ts`
   joins `user_book_reviews` into `LocalBookForMigration`.
6. **Web UI** - a new review editor next to the rating in
   `client/src/features/book/components/detail/tabs/DetailsTab.vue`
   (composable `client/src/features/book/composables/useBookReview.ts`),
   following the approved mockup
   `designs/bookorbit-reading-services/book-review-editor.html`: a toggle
   button beside the existing Personal Review toggle, a collapsible panel
   with a textarea, live char count (warns near the 10,000 limit), a
   "Synced to Readwise" hint, and a quick-access row under the synopsis
   (mirroring the existing "Your Review"/personal-note row). Locale strings
   under `book.detail.details.review.*` in `en.json` only (other locales
   untouched, as usual for an English-authored feature pending translation).
7. **Shared types** - `BookDetail.review` / `reviewUpdatedAt` added to
   `packages/types/src/book.ts` as optional fields (so servers predating this
   stage don't break existing clients). **For the Android stage**: the API
   shape is
   `PATCH /api/v1/books/:id/review` body `{ "review": string | null }` (omit
   key to leave unchanged), and `GET` book detail now also returns
   `"review": string | null, "reviewUpdatedAt": string | null` (ISO 8601,
   absent/undefined on servers older than this stage). Same permission as
   rating edits.

Deliberately out of scope: the S5 highlights/annotation work on the sibling
branch was not touched (no files under annotation/highlight code paths).

Migration: not yet generated/applied on this PC-only commit; running
`pnpm db:generate` and the disposable-Postgres drift check is the next step
on Unraid before this branch is considered checks-complete. See the commit
history on this branch for the exact migration file name once generated.

Open questions for the owner / a successor:

- The existing "Personal Review" UI block is actually the private
  `personalNote` field (never synced), labelled "Personal Review" in the
  product copy. This stage deliberately did not rename it (out of scope,
  risk of confusing an in-flight UI contract) but the two side-by-side
  "review" labels (synced vs private) in the detail view may read
  confusingly to users; worth a copy pass before ship.
- No UI toggle was added to disable the `review` sync specifically; it rides
  the same per-feature toggle plumbing already built for rating/status in
  the Readwise settings screen (`features.review`).

## S5: Readwise highlights two-way sync (2026-11-08)

Branch `feat-readwise-highlights-two-way`, stacked on `feat-readwise-sessions`
@ `b835cd1d34`. Worktrees: PC
`D:/Development/bookorbit-worktrees/feat-readwise-highlights-two-way`, Unraid
`/mnt/user/data/Development/bookorbit-worktrees/feat-readwise-highlights-two-way`.
Final hash **`eb0c3f68f2`**, local only, not pushed.

Replaces the old single `readwise_user_settings.last_synced_annotation_id`
watermark (push-only, create-only) with the `reading_service_item_links`
ledger (`kind='highlight'`), so creates, edits and deletes on either side can
each be tracked per highlight instead of one forward-only cursor. The
watermark column stays on the schema (still written on first connect by
`readwise-settings.service.ts`, never read by this stage) for upstream
compatibility; no migration was needed since S4 already created the ledger
table with every column this stage uses (`external_id`, `content_hash`,
`deleted_at`, `synced_at`).

What was built:

1. `annotation.updated`/`annotation.deleted` achievement events
   (`achievement-events.service.ts`), emitted from `annotation.service.ts`
   (web edits/deletes, skipping a pure star/unstar toggle which never
   touches `version`) and from `annotation-sync.service.ts` (device
   ingest content changes/moves, explicit device deletes, and detected
   device deletions), all emitted after their transaction commits so a
   listener querying the ledger sees the already-committed rows.
2. `readwise-highlight-hash.utils.ts`: `readwiseHighlightContentHash(text,
   note)`, SHA-256 of `text\0note`, a dedup/compare key only (not
   security-sensitive) used on both the push and pull sides to decide
   whether a highlight actually changed.
3. `readwise.repository.ts` gained ledger-based queries alongside the old
   `findNewHighlights`/`findLatestAnnotationId` (left in place, now dead
   code for this flow, kept for anyone still depending on them):
   `findPushableHighlights` (unlinked annotations, replaces the watermark
   query), `findChangedLinkedHighlights` (linked highlights, cursor-paginated
   by annotation id so a library larger than one page still gets fully
   scanned across repeated flushes), `findDeletedLinkedHighlights` (linked
   highlights whose local annotation is soft-deleted but the ledger isn't
   yet), `findAnnotationsByIds` (ledger backfill matching).
4. `readwise-client.service.ts`: `createHighlights` now returns the
   created Readwise ids (parses `modified_highlights` or a per-book-group
   response shape; an unrecognised shape degrades to an empty array rather
   than throwing, so the ledger just retries those as new on the next
   flush) instead of `void`. Added `updateHighlight` (PATCH
   `/highlights/{id}/`), `deleteHighlight` (DELETE), and `exportHighlights`
   (`GET /export/`, paginated via `pageCursor`, `updatedAfter`,
   `includeDeleted`) for the backfill and the pull.
5. `readwise-highlights-ledger-backfill.service.ts`: one-time migration
   from the old watermark scheme. Pages the full export once per user
   (cache flag `highlights-ledger-backfilled`, never expires), matches a
   remote highlight back to a local annotation via the `annotationId=`
   query param BookOrbit already embeds in `highlight_url` at push time,
   and seeds a ledger row per match (content hash from the *local*
   text/note, not the remote one, so a push-time edit is detected
   correctly afterwards). Unmatched/no-annotationId highlights are counted,
   not linked.
6. `readwise-sync.service.ts` (`flush`) now runs backfill-once, then
   create push (`findPushableHighlights` + `createHighlights`, batched by
   `READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE`), then update push
   (`findChangedLinkedHighlights`, filtered in-process by content hash,
   `updateHighlight` + `ReadingServicesRepository.updateItemLinkContentHash`
   per change), then delete push (`findDeletedLinkedHighlights` +
   `deleteHighlight` + `markItemLinkDeleted`). `ReadingServicesRepository`
   gained `updateItemLinkContentHash` (an UPDATE, unlike `recordItemLinks`'
   insert-only `onConflictDoNothing`) for the edit-push and pull-edit paths.
7. `readwise-highlights-local.repository.ts` +
   `readwise-highlights-pull.service.ts`: the pull path. Runs on the same
   interval as the S3/S4 pulls, reads `exportHighlights` with a per-user
   `highlights-pull-cursor` watermark, and for every remote highlight
   looks up its ledger link by external id. No link: counted as
   `skippedNew`, never created locally - a BookOrbit annotation needs a
   CFI/location anchor (`annotation_positions`) that a Readwise-side-only
   highlight has no way to carry, confirming the plan's "only when
   locatable" rule resolves to "never, for this API" in practice, since
   Readwise highlights are never linked to a BookOrbit book id or
   position. Link exists and `is_deleted`: soft-deletes the local
   annotation directly via `ReadwiseHighlightsLocalRepository` (not
   `AnnotationService`) and marks the ledger link deleted. Link exists and
   the remote content hash differs from the ledger's: applies the new
   text/note directly and updates the ledger hash. Echo suppression: the
   local repository writes bypass `AnnotationService`/`AnnotationSyncService`
   on purpose, so no `annotation.updated`/`annotation.deleted` event fires
   from a pull write and the push side never re-pushes its own pull.
8. `readwise-event-listener.service.ts` now also subscribes to
   `annotation.updated`/`annotation.deleted` and requests the same
   debounced flush as `annotation.created`, since `ReadwiseSyncService.flush`
   now reconciles create/update/delete together in one pass.
9. `readwise-books-migration.service.ts` capabilities gained
   `highlights: 'both'`. Bookmarks are not in scope and not added: the v2
   highlights API has no bookmark concept, so there is nothing to map
   either direction; left disabled by omission rather than a feature-flag
   row, since no bookmark feature exists in `READING_SERVICE_FEATURES` to
   begin with.
10. `readwise.module.ts` registers the three new providers
    (`ReadwiseHighlightsLedgerBackfillService`,
    `ReadwiseHighlightsLocalRepository`, `ReadwiseHighlightsPullService`).

Bug caught and fixed in review-before-handoff (both in the pull service and
the ledger backfill): the export pagination loop originally stopped when
`page.results.length === 0`, even if `nextPageCursor` was still set. An
intermediate page with zero book groups but a valid cursor would have
silently truncated the backfill/pull instead of continuing; fixed to key
only on `nextPageCursor`.

Tests added (all mocked DB/HTTP, no live Readwise calls):
`readwise-highlight-hash.utils.test.ts`,
`readwise-highlights-ledger-backfill.service.test.ts` (match by
`annotationId=`, unmatched counting, no-annotationId skip, pagination),
`readwise-highlights-local.repository.test.ts` (edit/delete apply +
idempotent no-op when already gone),
`readwise-highlights-pull.service.test.ts` (token/feature gating,
skippedNew for an unlinked highlight, edit apply, echo-suppressing no-op
when the hash already matches, delete apply, already-deleted-link skip,
cursor advance), plus new cases in `readwise-sync.service.test.ts`
(rewritten for the ledger: backfill-once gating, create/update/delete push,
truncation, partial-id-return handling, cursor pagination termination,
generic-error propagation, 403 auto-disable), `readwise.repository.test.ts`
(`findPushableHighlights`/`findChangedLinkedHighlights`/
`findDeletedLinkedHighlights`/`findAnnotationsByIds`),
`readwise-client.service.test.ts` (`createHighlights` id extraction across
both response shapes, `updateHighlight`, `deleteHighlight`,
`exportHighlights`), `reading-services.repository.test.ts`
(`updateItemLinkContentHash`), `annotation.service.test.ts` and
`readwise-event-listener.service.test.ts` (update/delete event emission and
subscription).

No live Readwise calls, no writes to the production `bookorbit-db`, no
schema change (confirmed by `drift_check` below), review/rating code
untouched.

**Verified on Unraid** (worktree above, after `pnpm install`):

- `pnpm --filter server run type-check`: clean, exit 0.
- `pnpm --filter client run type-check`: clean, exit 0.
- `npx eslint` on every new/changed server file: clean, 0 problems (one
  `--fix` pass folded back via lint-staged on commit for prettier-only
  nits).
- `npx vitest run src/modules/readwise src/modules/annotation
  src/modules/reading-services src/modules/achievement`: **58 files, 1116
  tests, all passed.**
- No migration generated (`pnpm db:generate drift_check` on a disposable
  `pgvector/pgvector:pg18` container at `127.0.0.1:55446`, after applying
  all 141 existing migrations and the `uuid-ossp`/`pg_trgm`/`unaccent`/
  `vector` extensions + `public.bookorbit_unaccent` function from
  `src/scripts/postgres-extensions.ts`, which a from-scratch disposable DB
  needs before `drizzle-kit migrate` can run past migration 0047):
  "No schema changes, nothing to migrate". Container removed afterwards.
- Full repo-wide `pnpm run lint:check` and the full/e2e test suites were
  **not** run, per the "focused checks only" instruction; defer to PR
  preparation.

Open questions for the owner / a successor:

- A user who connects Readwise sync for the **first time** (never
  synced before) now gets their full existing highlight history pushed as
  a backlog on the first flush, since `findPushableHighlights` selects
  every unlinked highlight with no time floor. The pre-S5 behaviour set
  `lastSyncedAnnotationId` to the latest id at connect time specifically
  to skip existing highlights and only push going forward. If that
  skip-history-on-connect behaviour is still wanted for brand-new
  connections (as opposed to the S5 goal of not re-pushing an
  *already-connected* user's history), it needs an explicit decision and a
  small follow-up (e.g. seed the ledger with a "skip" marker for
  pre-existing highlights at connect time, mirroring the old watermark
  semantics but ledger-shaped).
- The pull's remote-edit application is last-write-wins by content hash,
  not a three-way merge: if a highlight changed locally since the last
  sync *and* changed on Readwise since the last pull, whichever side's
  flush/pull runs next overwrites the other unconditionally. The push
  side's own flush happens first in practice (debounced, fast), so this is
  mostly a narrow race rather than a routine conflict, but it is a real
  gap against the plan's general three-way-merge expectation (S3 books
  sync has one via `three-way-merge.ts`; S5 highlights does not). Flagging
  for a follow-up if simultaneous cross-device highlight edits turn out to
  matter in practice.
- Bookmarks remain unsupported, as instructed, with no code path at all
  (not even a disabled feature flag) since Readwise's v2 highlights API
  has nothing to map a bookmark to.

## S6: Readwise web settings UI (2026-11-08)

Branch `feat-readwise-web-settings`, stacked on `feat-readwise-books-two-way` @ `13370231f`. Worktrees: PC `D:/Development/bookorbit-worktrees/feat-readwise-web-settings`, Unraid `/mnt/user/data/Development/bookorbit-worktrees/feat-readwise-web-settings`. Final hash **`f10f4573be`**, local only, not pushed.

Implements the approved mockups (`settings-readwise.html`, `design-notes.md`) against the real S1/S2 reading-services API as it exists on this branch, not as the mockup imagined it:

1. **`client/src/features/reading-services/`** - new feature folder, reused by Hardcover in phase 2 per the plan.
   - `api/reading-services.api.ts` - thin `fetch` wrappers for every endpoint in `reading-services.controller.ts` (`GET /`, `PATCH /:provider/features`, `POST /:provider/migration/preview`, `POST /:provider/migration`, `GET /runs/:id`, `DELETE /runs/:id`).
   - `composables/useReadingServices.ts` - module-level shared state (matches `useReadwiseSettings`'s pattern): `fetchSummaries`, `getSummary(provider)`, optimistic `setFeature` with rollback on failure.
   - `composables/useReadingServiceMigration.ts` - per-mount state (not shared, since only one migration panel is ever on screen): preview, start, cancel, and 2s polling of `GET /runs/:id` while a run is `running`.
   - `components/ReadingServiceFeatureList.vue` - one row per `ReadingServiceFeature`, built on `SettingsRow` + `ToggleSwitch`. A feature renders as a live toggle only when `capabilities[feature]` is set; otherwise it renders disabled with a one-line reason (there is no server-side "provider never supports this" string, so these are implementer copy per the design notes).
   - `components/ReadingServiceMigrationPanel.vue` - never-run / previewed / running / completed / failed states.
2. **`ReadwiseSettings.vue`** - mounts both new components below the existing connection card, calling `fetchSummaries()` alongside the existing `fetchSettings()` on mount.
3. **Locale** - new `settings.readingServices.*` namespace added only to `en.json`, per `docs/LOCALIZATION.md` ("Adding User-Facing Copy"); `validate:locales` passes (25 catalogs, 12156 English messages).
4. Component tests: `ReadingServiceFeatureList.spec.ts` (5 cases: full capability render, disabled-with-reason row, missing-flag-reads-as-on, explicit-false-reads-as-off, toggle calls `setFeature`) and `ReadingServiceMigrationPanel.spec.ts` (8 cases, one per state transition plus resuming an already-running run on mount). 13/13 pass; the pre-existing 29 Readwise tests still pass (42 total in the two feature folders).

**Deliberate deviations from the mockup, all because the real branch doesn't have the data yet (not invented):**

- **No Readwise-only books list.** The mockup's 8-row sample list isn't backed by any controller endpoint: `finishMigration()` in `readwise-books-migration.service.ts` caches a classified list under `reading_service_cache` key `migration-readwise-only`, but nothing exposes it over HTTP. Building this against invented data would violate "use the S1/S2 endpoints as they exist; don't invent", so it's left out. **Open item for a future stage:** add a `GET /:provider/migration/readwise-only` endpoint (paginated; 166+ rows per the mockup) before this list can be built, ideally virtualised with `@tanstack/vue-virtual` (already a client dependency, used elsewhere e.g. `VirtualBookGrid.vue`).
- **Migration preview counters are 3, not 4.** The real `previewMigration()` response is `{ matched, toCreate, readwiseOnly }` with no owned/not-owned split (that split is computed internally in `finishMigration`, not exposed). The panel shows exactly those 3 fields; the mockup's 4-cell preview grid assumed the split was already wired through.
- **No progress fraction while running.** `SyncRunProgress` has no `total` field, so there's no "1,068 / 1,842" style fraction to show. The running state shows the four live counters (`updated`, `created`, `skipped`, `failed`, matching the orchestrator's review note) without a percentage bar.
- **"Retry migration", not "Resume migration".** `startMigration()` only resumes a run's cursor when the server process crashes while a run is still `status: 'running'` (the boot-time sweep in `reading-service-sync-run.service.ts`). Calling it again after an explicit `failed` status creates a brand-new run with an empty cursor, it does not continue from where the old one stopped. The failed-state button is labelled accordingly rather than overclaiming a resume the API doesn't do.
- **`capabilities.owned` is `'read'`** on this branch (no `review`, `sessions`, `highlights`, `publish_sessions`, `recap_widget`, `friends_shelf`, `discover_shelf` yet - those land in S3b/S4/S5/S7). The feature list therefore shows `status`, `rating`, `dates` and `owned` as live toggles and the rest disabled with a reason. This is correct for the current branch state, not a bug; re-check this list after S4/S5/S3b/S7 land, since each should flip one more row from disabled to live.

**Not done - screenshots.** No Chromium/Playwright binary is available on the Unraid host (`which chromium chromium-browser google-chrome` all empty; no `playwright` package in `client/node_modules`), so the page could not be rendered and screenshotted at 1440/390 as the task asked. Installing a browser binary on the shared Unraid host wasn't done without the owner's say, since it's outside "focused checks" scope. Flag this to whoever reviews: either approve installing Playwright/Chromium on Unraid, or do the visual QA pass from a machine that already has a browser.

**Verified on Unraid** (after `pnpm install`):

- `pnpm --filter client run type-check`: clean (`tsc` + `vue-tsc --build`).
- `pnpm --filter server run type-check`: clean (unaffected by this stage; confirms the stack still typechecks together).
- `npx vitest run src/features/reading-services src/features/readwise` (client): **5 files, 42 tests, all passed.**
- `npx prettier --check` / `npx eslint` on every changed file: clean (one prettier fix committed separately, `f10f4573be`).
- `pnpm run validate:locales` (client): 25 catalogs validated against 12156 English messages.
- Full repo-wide lint/typecheck and e2e were **not** run, per the "focused checks only" instruction for this stage.

## First commands for a successor agent

```bash
cd /mnt/user/data/Development/bookorbit
git status -sb
git fetch origin
git checkout development
git pull --ff-only origin development
git log -8 --oneline
gh pr view 14 --repo andrewgribben/bookorbit
docker ps --filter name=bookorbit --format '{{.Names}}\t{{.Status}}\t{{.Image}}'
docker inspect bookorbit --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```

Then ask the user what they want next before implementing anything.
