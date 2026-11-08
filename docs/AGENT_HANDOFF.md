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

## S7/S6: Readwise reading-recap widget + owned-elsewhere shelf (2026-11-08)

Branch `feat-reading-services-widgets`, stacked on `feat-book-review` @
`59fdcb42`. Worktrees: PC `D:/Development/bookorbit-worktrees/feat-reading-services-widgets`,
Unraid `/mnt/user/data/Development/bookorbit-worktrees/feat-reading-services-widgets`.
Commit **`147c3bf38`** plus a small eslint/locale fixup folded into the same
commit before final push to Unraid for verification; local only, not pushed.

Scope: dashboard reading-recap widget (S7) and the "Owned elsewhere" shelf
(S6/S7, D1), server + web, per the approved mockups
`designs/bookorbit-reading-services/dashboard-recap-widget.html` and
`owned-elsewhere-shelf.html`. Deliberately stayed out of
`ReadingServiceMigrationPanel`/the settings feature list (a sibling agent on
`feat-reading-services-integration` owns those).

What was built:

1. **Types** (`packages/types/src/reading-services.ts`, `dashboard.ts`) -
   `ReadingRecapMonthData` (`month` 1-12, `seconds`), `ReadingRecapWidget`
   (`provider`, `year`, `booksFinished`, `sessions`, `totalSeconds`,
   `readingDays`, `goal: number | null`, `byMonth`), new widget type
   `"reading-recap"` mapped to `ReadingRecapWidget | null` in
   `DashboardWidgetDataMap`. `ExternalBookCard` (`title`, `author`,
   `coverUrl`, `isbn13`, `provider`, `providerUrl`, `libraryBookId`,
   `people`) and `ExternalBookShelfResponse` (`books`, `total`) are
   deliberately **generic on `provider`**, not Readwise-specific, so a future
   Hardcover "owned elsewhere"-style shelf can reuse the same shapes without
   a new type.
2. **`ReadwiseRecapService`** (`server/src/modules/readwise/readwise-recap.service.ts`) -
   calls the S2 `ReadwiseBooksClientService.statsSummary` + `.sessionsByDay`
   for the given year, buckets `sessionsByDay` into 12 months, caches the
   built widget in `reading_service_cache` under key `recap:<year>` for 1h
   (`READWISE_RECAP_CACHE_TTL_MS`). Returns `null` (never a zeroed shape)
   when Readwise isn't connected, `disabledReason` is set, the
   `recap_widget` feature toggle is off, there's no token, or the Readwise
   call fails for any reason (a 403 also auto-disables the connection, same
   pattern as every other Readwise adapter). This null-vs-empty-object
   distinction is what lets the widget hide entirely per the design notes'
   "Orchestrator visual review" item, rather than rendering a zeroed card
   for a provider nobody connected.
3. **`ReadwiseOwnedElsewhereService`** (`readwise-owned-elsewhere.service.ts`) -
   pages the full remote Books library, excludes books already linked via
   `reading_service_book_links` (`ReadingServicesRepository.findBookLinksForProvider`),
   classifies the rest with the existing S2 `readwise-book-ownership.ts`
   (`classifyReadwiseOwnership`), keeps only `'owned'` (D9: "Readwise-only
   books appear only when owned"; `'unknown'`/`'not_owned'` excluded), and
   independently runs the shared pure `book-matcher.ts` against the local
   library so a card can still carry `libraryBookId` for a book that
   happens to match but isn't synced yet. Cached 6h under cache key
   `owned-elsewhere`. Same connection/feature/403 gating as the recap
   service, returning `[]` instead of `null` (a list, not a nullable
   widget).
4. **Endpoints** - `GET /api/v1/dashboard/widgets/reading-recap` (through
   the existing `DashboardWidgetService`/`DashboardController` widget-batch
   machinery, added as a new entry in `widgetLoaders`) and
   `GET /api/v1/dashboard/shelves/owned-elsewhere` (its own small endpoint,
   not batched, returning `ExternalBookShelfResponse`).
5. **`DashboardModule`** now imports `ReadwiseModule` (no cycle: neither
   `ReadwiseModule` nor anything it imports references `DashboardModule`).
6. **Web** - `ReadingRecapWidget.vue` registers as a normal dashboard widget
   (`DashboardWidgetRow.vue`'s `widgetComponents`/`widgetLayout` maps, size
   `1x1.5` like Reading Rhythm) via `useReadingRecapWidget`/`fetchReadingRecap`
   following the exact `useWidgetData` pattern every other widget uses. It
   renders a KPI strip (books finished, hours, sessions, reading days), a
   goal progress bar (or a "no goal set" line when `goal` is null), and a
   12-month bar chart where the **current month's bar uses the `bg-primary`
   accent token** per the design notes, others `bg-primary/40` (has data) or
   `bg-muted/50` (no data). `OwnedElsewhereShelf.vue` + `useOwnedElsewhereShelf.ts`
   are a standalone component/composable (not routed through
   `DashboardScroller.vue`'s batched scroller system, since `ExternalBookCard`
   is not a `BookCard` and can't flow through that batch shape), wired into
   `DashboardView.vue` right after `DashboardWidgetRow`. Cover-missing cards
   use the exact same `aspect-ratio: 2/3` tile as cards with a cover, per the
   design notes, just with a text fallback instead of an `<img>`. Tapping a
   card opens the matched BookOrbit book (`libraryBookId` set) or the
   book's Readwise page in a new tab otherwise.
7. **Known deviation from the design notes' "hidden entirely" requirement** -
   `ReadingRecapWidget.vue` itself renders nothing (no DOM at all) when the
   endpoint returns `null`, which is the component-level half of "hidden
   entirely". However `DashboardWidgetRow.vue`'s per-widget wrapper `<div>`
   (border/background shell) is rendered unconditionally by the row grid
   before any child widget's own async data resolves, since the row doesn't
   know a widget's data ahead of mount. The practical effect: there may be a
   brief empty bordered box during the loading flash, and if a future
   refactor moves the empty-check logic, the shell could outlive the hidden
   content. Flagging for QA to actually look at a disconnected account in
   the browser (this was not screenshot-verified, only reasoned through the
   markup) and for the owner to decide if `DashboardWidgetRow.vue` needs a
   "does this widget type's data resolve to null, and if so skip the shell
   entirely" mechanism added generically.
8. **Locale** - `dashboard.settings.widgetNames.readingRecap`,
   `dashboard.widgets.readingRecap.*` (title, the four KPI labels, goal
   line, no-goal line, 12 short month labels), and `dashboard.ownedElsewhere.*`
   (title, description, viewAll, empty, failedToLoad) added to `en.json`
   only, matching the existing pattern of English-only strings for new
   features pending translation. `validate:locales` passes (other locale
   catalogs fall back to English for untranslated keys by design).

Tests added: `readwise-recap.service.test.ts` (8 cases: disabled/no-token/
feature-off/cached/built-from-stats/403-disables/other-error-returns-null),
`readwise-owned-elsewhere.service.test.ts` (9 cases: disabled/feature-off/
no-token/cached/excludes-linked/excludes-not-owned/returns-unlinked-owned/
matches-by-isbn/403-disables), plus new cases folded into the existing
`dashboard-widget.service.test.ts` and `dashboard.controller.test.ts` for
the new loader/endpoint wiring. Client:
`ReadingRecapWidget.spec.ts` (hides on null, shows KPIs+goal, shows no-goal
message) and `OwnedElsewhereShelf.spec.ts` (hides when empty, renders
cover-missing fallback, routes to library book vs opens Readwise tab).
**Verified on Unraid** (worktree above, after `pnpm install`):

- `pnpm --filter server run type-check`: clean, exit 0.
- `pnpm --filter client run type-check`: clean, exit 0 (after fixing one
  pre-existing test, `useDashboardLabels.spec.ts`'s `WIDGET_KEY_BY_TYPE`
  map, which is a hand-maintained mirror of every `WidgetType` and needed
  the new `reading-recap` entry added; copied back to the PC and folded
  into the same commit).
- `npx eslint` on every new/changed server and client file: clean after one
  `--fix` pass on three test files (prettier-only multi-line-literal
  formatting), copied back to the PC and folded into the commit.
- `npx prettier --check` on every new/changed file: all matched files use
  Prettier style.
- `npx vitest run` targeted: server **4 files / 88 tests passed**
  (`readwise-recap.service.test.ts`, `readwise-owned-elsewhere.service.test.ts`,
  `dashboard-widget.service.test.ts`, `dashboard.controller.test.ts`); client
  **3 files / 21 tests passed** (`ReadingRecapWidget.spec.ts`,
  `OwnedElsewhereShelf.spec.ts`, `useDashboardLabels.spec.ts`).
- `pnpm --filter client run validate:locales`: "Validated 25 locale
  catalogs against 12129 English messages", clean.
- No schema change, so no migration/disposable-Postgres step was needed.
  No live Readwise calls, no writes to `bookorbit-db`.

API shapes for the Android stage:

- `GET /api/v1/dashboard/widgets/reading-recap` -> `ReadingRecapWidget | null`:
  `{ provider: "readwise", year: number, booksFinished: number, sessions:
  number, totalSeconds: number, readingDays: number, goal: number | null,
  byMonth: { month: 1-12, seconds: number }[] }`. `null` means hide the
  widget entirely (disconnected, feature off, or no data available); do not
  render a zeroed card.
- `GET /api/v1/dashboard/shelves/owned-elsewhere` -> `ExternalBookShelfResponse`:
  `{ books: ExternalBookCard[], total: number | null }`. `ExternalBookCard`:
  `{ title: string, author: string | null, coverUrl: string | null, isbn13:
  string | null, provider: string, providerUrl: string | null,
  libraryBookId: number | null, people: string[] }`. Empty `books` array
  (not absent) when disconnected or nothing to show. `libraryBookId` set
  means the app should deep-link to that local book instead of
  `providerUrl`.

Open questions for the owner / a successor:

- `READWISE_BOOK_WEB_URL_BASE = 'https://readwise.io/books'` used to build
  `providerUrl` in the owned-elsewhere service is a best-effort guess, not
  confirmed against Readwise's documentation (`readwise-api.md` does not
  document a per-book web URL). Verify the real URL pattern (or drop
  `providerUrl` to `null` if there isn't a stable one) before relying on it
  in the Android client or shipping this to real users.
- `people` on `ExternalBookCard` is always `[]` for Readwise (no
  per-contributor data in the Books API beyond a single `author` string);
  kept in the generic shape in case a future provider (Hardcover) has
  structured contributor data.
- The `DashboardWidgetRow.vue` shell-while-loading-then-hidden behaviour
  noted above (point 7) was reasoned through, not screenshot-verified in a
  live browser; worth a manual QA pass against a test account with Readwise
  disconnected before this ships.
- No E2E/integration test against a disposable Postgres was run (no schema
  change, nothing to migrate); only unit/component tests as listed above.

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

## S8: feat-reading-services-integration (2026-11-08)

Integration branch `feat-reading-services-integration`, created from `feat-book-review` @
`59fdcb423`, then `git merge --no-ff feat-readwise-highlights-two-way` (`a5ecf8942`) and
`git merge --no-ff feat-readwise-web-settings` (`72f9289c0`). Worktrees: PC
`D:/Development/bookorbit-worktrees/feat-reading-services-integration`, Unraid
`/mnt/user/data/Development/bookorbit-worktrees/feat-reading-services-integration`. Local
only, not pushed.

Both merges conflicted only in this file (each stage's handoff section landed back to back,
resolved by keeping both sections in sequence, no code conflicts). `client/src/locales/en.json`
auto-merged cleanly as a union of both stages' additions. There is no
`registry/capabilities/en.json` file in this repo; the task's mention of that path did not
apply here.

After the merges, this stage closed three gaps the S6 web-settings handoff flagged as blocked
on missing server support, now unblocked because S3b/S4/S5 had since landed on the branches
being merged in:

1. **`GET /api/v1/reading-services/:provider/migration/readwise-only`** (paginated,
   `offset`/`limit` query params, clamped to a 100-row max page) - exposes the classification
   `ReadwiseBooksMigrationService.finishMigration` already cached under
   `migration-readwise-only` but never had an HTTP route. Added an optional
   `listRemoteOnlyBooks?(userId, offset, limit)` method to `ReadingServiceProviderAdapter` so
   the controller stays provider-agnostic; only the Readwise adapter implements it. The cached
   classification now also carries `author`, `coverImageUrl` (from a new `product.cover_image`
   field added to `ReadwiseBookProduct`, parsed if present) and `externalUrl` (always `null`:
   the Readwise Books API response this client parses has no public web URL for a book entry,
   so this stays unfilled rather than guessing a URL shape). Shared types:
   `ReadingServiceRemoteOnlyBook` / `ReadingServiceRemoteOnlyBooksPage` in
   `packages/types/src/reading-services.ts`. Client: `ReadingServiceMigrationPanel.vue` renders
   the list (cover thumbnail, title, author, ownership pill) below the migration state card and
   loads the next page on demand; `useReadingServiceMigration.ts` auto-loads it on mount when
   `summary.migration.state === 'done'`, and again once a tracked run completes.
2. **Resume a failed migration from its cursor.** `ReadingServiceSyncRunService.resumeMigration(id, userId)`
   resets a `failed` run back to `running` (clearing `error`/`finishedAt`) and re-enters
   `runLoop` from the run's own stored `cursor`/`counters`, instead of `startMigration`'s old
   path of always creating a brand-new run with an empty cursor. New endpoint
   `POST /api/v1/reading-services/runs/:id/resume`. Throws `BadRequestException` if the run
   isn't currently `failed`. Client button label is "Resume migration" (was "Retry migration").
   The now-unused `retryButton` locale key was left in place rather than removed, since
   `validate:locales` does not flag unused keys and removing it was not necessary for this
   stage.
3. **`publish_sessions` defaults to off.** `READING_SERVICE_FEATURES_DEFAULT_OFF` (currently
   just `publish_sessions`) is a new exported list in `packages/types`;
   `ReadingServiceFeaturesService.getFeatures` now merges this default into the DB-backed
   feature map before returning, so a user who has never touched the toggle gets an explicit
   `false` rather than the generic opt-out-reads-as-on semantics every other feature uses. Label
   is "Share sessions to my {provider} feed" (interpolated, since this component is shared with
   the still-unbuilt Hardcover settings page) and the row renders indented (`pl-6`) under
   "Reading sessions" in `ReadingServiceFeatureList.vue`, matching the mockup's sub-row
   treatment.
4. **Bookmarks row.** Added `"bookmarks"` to `READING_SERVICE_FEATURES` (previously absent
   entirely, per the S5 handoff's explicit note that there was no bookmark feature to disable).
   No adapter declares a capability for it, so `ReadingServiceFeatureList`'s existing generic
   "disabled with a reason" rendering picks it up automatically; no new disabled-row logic was
   needed, only the locale strings (`features.bookmarks.*`) and the feature-key addition. Review,
   sessions and highlights were already live toggles on this branch (capabilities carried
   `review: 'both'`, `sessions: 'both'`, `highlights: 'both'` since S3b/S4/S5), so no code change
   was needed there beyond the merge itself; the S6 handoff's note to "re-check this list after
   S4/S5/S3b/S7 land" is resolved by the merge alone.

Visual QA: no `design-taste-frontend` skill is registered in this Hermes profile, so the
readwise-only list and the publish_sessions row were built to match the existing
`ReadingServiceFeatureList`/`ReadingServiceMigrationPanel` component grammar exactly (same
`SettingsRow`/`ToggleSwitch`/card/counter-grid patterns, same cover-thumbnail sizing as
`AchievementBookCover.vue`) rather than against a design-system review, as instructed for that
fallback case.

Tests added/updated: `reading-service-features.service.test.ts` (default-off and
stored-override cases), `reading-service-sync-run.service.test.ts` (resume-from-cursor,
reject-resuming-a-non-failed-run, not-found), `reading-services.controller.test.ts`
(resume endpoint permission checks, readwise-only list endpoint delegation and the
no-adapter-support empty-page fallback), `readwise-books-migration.service.test.ts`
(`listRemoteOnlyBooks` classification shape and pagination). Client:
`ReadingServiceFeatureList.spec.ts` (bookmarks renders disabled with reason, switch count
bumped to 12), `ReadingServiceMigrationPanel.spec.ts` (resume button and handler, readwise-only
list rendering, load-more visibility, auto-load on a `state: 'done'` summary).

**Verified on Unraid** (worktree above, after `pnpm install`):

- `pnpm --filter @bookorbit/types run build`: clean.
- `pnpm --filter server run type-check`: clean, exit 0.
- `pnpm --filter client run type-check`: clean, exit 0 (`tsc` + `vue-tsc --build`).
- `npx vitest run src/modules/reading-services src/modules/readwise` (server): **34 files,
  301 tests, all passed.**
- `npx vitest run src/features/reading-services src/features/readwise` (client): **5 files,
  47 tests, all passed.**
- `npx eslint` on every new/changed file (server + client): clean after one `--fix` pass for
  prettier-only wrapping (4 files), copied back to the PC worktree as a diff and committed there
  (never committed on Unraid, per the task rules).
- `npx prettier --check` on every changed file: clean.
- `pnpm run validate:locales` (client): 25 catalogs validated against 12181 English messages.
- Migrations 0001-0142 applied cleanly on a disposable `pgvector/pgvector:pg18` container
  (`bookorbit-disposable-rsi`, port 55447, removed afterwards) after bootstrapping
  `uuid-ossp`/`pg_trgm`/`unaccent`/`vector` + `public.bookorbit_unaccent` from
  `postgres-extensions.ts`; `pnpm db:generate drift_check` reported "No schema changes, nothing
  to migrate" (expected: this stage only added TypeScript-level fields/features, no schema
  change).
- Full repo-wide lint/typecheck and e2e were **not** run, per the "focused checks only"
  instruction for this stage.

Open questions for the owner / a successor:

- `externalUrl` on a readwise-only book is always `null`. If Readwise Books does expose a
  public web URL for an entry somewhere in its API that this client doesn't currently parse,
  wiring it through would need a confirmed field name, not a guess.
- `coverImageUrl` depends on `product.cover_image` being present in the Readwise Books API
  response; this field was added defensively based on the documented Books API shape but has
  not been exercised against a live Readwise account, since this task never calls the real
  Readwise API. If covers show up blank in practice, check the actual field name Readwise
  returns.
- The unused `settings.readingServices.migration.retryButton` / `retryingButton` locale keys
  were left in place rather than removed (the panel no longer reaches that state transition);
  harmless but worth a cleanup pass if someone is already touching that file.
- The readwise-only list panel only loads when a migration's last run is `completed`
  (`state === 'done'`) or a tracked run just finished; it is not shown for `never`, `running` or
  `failed` states, matching the idea that this list reflects the *last successful* migration's
  classification, not a live query. If the product intent is to show it in more states, that
  is a product decision, not something this stage inferred from the API.
---

## Phase 2: Hardcover social shelves (2026-11-08)

Branch `feat-hardcover-social`, stacked on `feat-book-review` @ `59fdcb423`.
Worktrees: PC
`D:/Development/bookorbit-worktrees/feat-hardcover-social`, Unraid
`/mnt/user/data/Development/bookorbit-worktrees/feat-hardcover-social`. Head
commit **`18803ef09`**, local only, not pushed. Two commits: the feature, then
a lint/prettier follow-up (both local, no `--no-verify`).

Server only, no client/web/Android changes in this stage, per the card.

What was built (plan section 7 items 1 and 2/3, scoped to social shelves and
the private-adapter hook; external-book dashboard scroller cards from §7.2
and Android parity from §7.6 are explicitly out of scope here):

1. **`HardcoverReadingServicesAdapterService`**
   (`server/src/modules/hardcover/hardcover-reading-services-adapter.service.ts`)
   registers with the shared `ReadingServiceRegistry` in `onModuleInit`, the
   same pattern `ReadwiseBooksMigrationService` already uses. Its
   `capabilities` map declares `status: 'both'`, `rating: 'both'`,
   `dates: 'both'` (mirroring `HardcoverSettingsService`'s existing
   `autoSyncOnStatusChange`/`autoSyncOnRatingChange`/`autoSyncOnProgressUpdate`
   toggles, which already sync both ways) plus the three new read-only social
   capabilities `friends_shelf`, `trending_shelf`, `recommendations_shelf`.
   It deliberately does **not** claim `owned` or `review`, since the existing
   module does not sync either. `migratePage` is a no-op (returns `null`) and
   `pull` refreshes the four cached shelves: this adapter never writes a
   user's own Hardcover state, that stays entirely with
   `HardcoverSyncService`/`HardcoverImportService`/`HardcoverEventListener`,
   which this stage did not touch at all.
2. **`HardcoverSocialService`**
   (`server/src/modules/hardcover/hardcover-social.service.ts`) holds the
   GraphQL queries and shaping for all four shelves:
   - `friends-reading` / `friends-finished` -> `followed_user_books` filtered
     by `status_id` (2 = currently reading, 3 = read within the last 90
     days).
   - `trending` -> `books_trending`.
   - `recommendations` -> **not available from Hardcover** (research doc
     confirms no algorithmic recommendations root field exists). Implemented
     as a documented best-effort proxy: the most-added books
     (`books(order_by: {users_count: desc})`), filtered to exclude books
     already linked in `reading_service_book_links` for that user. This must
     be revisited if Hardcover ever ships a real recommendations field.
   - **UNVERIFIED GraphQL queries, called out explicitly in code comments**:
     `followed_user_books`'s and `books_trending`'s exact argument shapes
     were not confirmed by introspection against a live token (the research
     doc only confirms the root field *names* exist, per risk #6 in
     `research/hardcover-api.md`). `parseTrendingResponse` treats any
     unexpected `books_trending` shape as an empty shelf rather than
     throwing, per the research doc's "defensive parsing" mitigation for the
     beta API risk. **Before this goes live, introspect the schema with a
     real token and adjust the query/variable names if they differ.**
3. **Matching to local books** -
   `HardcoverSocialMatchRepository.findCandidates` (new file
   `hardcover-social-match.repository.ts`) does a bounded, indexed lookup
   (isbn13 equality, `lower(title)` using the existing `bm_title_lower_idx`)
   scoped to the shelf batch's own isbn/title set, not a full-library scan,
   then `HardcoverSocialService` reuses the existing
   `reading-services/book-matcher.ts` (`buildRemoteIndex`/`matchBook`,
   unchanged) in the reverse direction from how the Readwise migration uses
   it. No direct unit test was written for the repository itself (DB-query
   heavy, no equivalent exists for the sibling
   `readwise-books-local-books.repository.ts` either); it is exercised
   indirectly through `HardcoverSocialService`'s tests via a mocked
   repository interface. Flag this if a future stage wants real DB
   coverage.
4. **Caching** - each shelf is cached under `reading_service_cache` key
   `shelf:<shelf-name>` for 6 hours (`SHELF_CACHE_TTL_MS`), inside the plan's
   "6-12h" budget for staying within Hardcover's 5k/day rate limit.
   `getShelf` serves the cache on a hit and falls through to a live fetch
   (caching the result) on a miss or an unconnected user returns `[]`.
5. **Generic endpoint** - `GET /api/v1/reading-services/:provider/shelves/:shelf`
   added to the existing `ReadingServicesController`. Shelf names are the new
   `READING_SERVICE_SHELVES` tuple in `packages/types/src/reading-services.ts`:
   `friends-reading`, `friends-finished`, `trending`, `recommendations`. A
   shelf that is not one of those four 400s; a shelf the provider's adapter
   doesn't declare the matching capability for (`friends_shelf` for both
   friends shelves, `trending_shelf`, `recommendations_shelf`) or that has no
   `getShelf` implementation 404s, so a client can distinguish "not a real
   shelf name" from "this provider doesn't have this shelf". **Response shape
   (for the widgets/web agent, coordinate before changing it):**
   ```ts
   type ReadingServiceShelfItem = {
     provider: 'readwise' | 'hardcover'; // generic: a future Readwise shelf reuses the same shape
     externalId: string;
     title: string;
     authors: string[];
     coverUrl: string | null;
     externalUrl: string | null;
     bookId: number | null; // matched local BookOrbit book, or null
     friend: { displayName: string; avatarUrl: string | null; status: string; date: string | null } | null; // only on friends shelves
   };
   ```
   This lives in `packages/types/src/reading-services.ts` alongside
   `READING_SERVICE_SHELVES`. `ReadingServiceProviderAdapter.getShelf` is an
   optional interface method (same pattern as `previewMigration`), so a
   provider without a social graph implements nothing extra.
6. **Private adapter loading hook** (plan phase 2 item 5) -
   `ReadingServicePrivateAdapterLoaderService`
   (`server/src/modules/reading-services/reading-service-private-adapter-loader.service.ts`),
   wired into `ReadingServicesModule`'s providers so it runs on boot like
   every other `OnModuleInit` in this codebase. Controlled by the new
   `READING_SERVICES_PRIVATE_ADAPTERS_DIR` env var
   (`readingServicesConfig.privateAdaptersDir`), documented in
   `server/.env.example`. When unset (the default), it logs once and does
   nothing. When set, it scans that directory's top level for
   `index.mjs`/`index.js`, dynamically imports each with the same
   CJS-build/ESM-test straddle `PluginLoaderService` uses for indexer
   plugins, and registers a default export that looks like a
   `ReadingServiceProviderAdapter` (duck-typed check: `provider` string,
   `capabilities` object, and `isConnected`/`migratePage`/`pull` functions).
   It refuses to load something claiming a built-in provider name
   (`readwise`/`hardcover`) or a name already registered, and never throws
   out of `onModuleInit` itself (one bad file just gets a `[fail]` log line,
   the rest still try).
   - **Security, documented in the class's doc comment and the env.example
     entry**: a loaded module runs inside this process with full access
     (database, every other injected service, decrypted tokens). It is the
     exact same trust boundary `PluginLoaderService` already documents for
     indexer plugins. Nothing under this repo ships such a module; the env
     var only matters if an operator deliberately points it at a directory
     they wrote or audited themselves, outside the deployed tree. This was
     written with the personal Readwise-friends POC
     (`research/readwise-private-api-spike.md`, §9a D4) in mind as the
     eventual consumer, but that POC code was not touched, read, or
     referenced beyond this doc note.
   - **Open question for the owner/successor**: the registered private
     adapter is NOT currently reachable through
     `ReadingServicesController`, because `assertProviderAccess` only
     accepts the fixed `READING_SERVICE_PROVIDERS` tuple
     (`['readwise', 'hardcover']`) and maps each to a specific `Permission`.
     A private adapter with, say, `provider: 'readwise-friends'` registers
     successfully in the registry (so `list()` and the registry-level
     `has()`/`get()` work) but the controller's `/`, `/:provider/features`,
     `/:provider/shelves/:shelf` etc. routes will all 400 for it today. Fully
     solving this means generalising `PROVIDER_PERMISSIONS` (which
     permission gates an arbitrary private provider?) and is left as a
     follow-up rather than guessed at here.

**Tests** (all new/changed files, GraphQL mocked at the `fetch`/client-query
level, no live Hardcover calls, no real or disposable Postgres touched):
`hardcover-social.service.test.ts` (6 tests),
`hardcover-reading-services-adapter.service.test.ts` (9 tests),
`reading-service-private-adapter-loader.service.test.ts` (5 tests, using
real temp directories and real dynamic `import()` of written-to-disk
`.mjs` files, the same approach `plugin-loader.service.test.ts` uses),
plus new cases added to the existing
`reading-services.controller.test.ts` (3 new tests for the shelf endpoint).

**Verified on Unraid** (worktree above, after
`pnpm install --frozen-lockfile`, `pnpm --filter @bookorbit/types build`,
`pnpm --filter @bookorbit/plugin-api build`):

- `pnpm --filter server run type-check`: clean, exit 0.
- `pnpm --filter client run type-check`: clean, exit 0 (unaffected by this
  stage; run anyway per the gate list).
- `npx eslint src/modules/hardcover src/modules/reading-services` (server):
  clean, 0 problems.
- `npx prettier --check src/modules/hardcover src/modules/reading-services`
  (server): all matched files use Prettier style.
- `npx vitest run src/modules/hardcover src/modules/reading-services`
  (server): **27 test files, 439 tests, all passed** (includes every
  pre-existing Hardcover/reading-services test, confirming nothing broke).
- Full repo-wide lint, the client test suite, and e2e were **not** run, per
  "focused checks only" for this card.

Unresolved / notes for the next agent:

- The two UNVERIFIED GraphQL queries (`followed_user_books` args,
  `books_trending` shape) need a real-token introspection pass before any
  live smoke test of this stage.
- The controller-reachability gap for private adapters (point 6 above) needs
  an owner decision: generalise `PROVIDER_PERMISSIONS`/`assertProviderAccess`
  to accept any registered provider under some shared permission, or accept
  that private adapters are registry-only until a concrete private adapter
  needs the HTTP surface.
- `recommendations_shelf`'s "most-added, minus already-linked" proxy has no
  UI copy anywhere yet explaining it isn't a real recommendation; worth a
  product decision before a widgets/web stage surfaces it as "Recommended
  for you".
- No dashboard scroller/card UI was touched (plan §7.2), and no Android work
  (plan §7.6); both remain for a later stage once the shelf endpoint above is
  confirmed against a live token.

---

## Integration: widgets + Hardcover social merged, generic shelves (2026-11-08)

Merged `feat-reading-services-widgets` (`--no-ff`, `62462d047`) and
`feat-hardcover-social` (`--no-ff`, `5bef7afad`) into this branch, both from
`feat-book-review`. Followed by four small fix-up commits
(`37e29db4d`, `789b0c9d2`, `718494126`, `d709ad20b`): a type-check error in
the recap widget singleton, a prettier pass on one test file, a missing
`Permission` import in a test fixture, and a pre-existing gap in the widget
catalog spec (it never listed the new `reading-recap` type). No migrations
were added by either branch, so there was no schema/drift work to do.

### Generic provider shelves

The widgets branch's "owned elsewhere" shelf and the Hardcover branch's
friends/trending/recommendations shelves were two different HTTP surfaces
with two different response shapes. They are now one surface:

- `GET /api/v1/reading-services/:provider/shelves/:shelf` -> `ReadingServiceShelfItem[]`
  (`packages/types/src/reading-services.ts`). `shelf` is one of
  `READING_SERVICE_SHELVES`: `friends-reading`, `friends-finished`,
  `trending`, `recommendations`, `owned-elsewhere`. Each item:
  ```ts
  {
    provider: ReadingServiceProvider
    externalId: string
    title: string
    authors: string[]
    coverUrl: string | null
    externalUrl: string | null
    bookId: number | null          // matched BookOrbit book, if any
    friend: { displayName: string; avatarUrl: string | null; status: string; date: string | null } | null
  }
  ```
  404s if the adapter does not declare the matching capability
  (`friends_shelf`/`trending_shelf`/`recommendations_shelf`/`owned`) or has
  no `getShelf`; 400 for an unknown shelf name or unregistered provider;
  403 if the caller lacks the provider's permission (see below).
- `GET /api/v1/reading-services/shelves/available` ->
  `{ provider, shelf, connected }[]` - every shelf a provider the caller has
  permission for currently declares via `capabilities`, for a future
  "Customize Dashboard" picker (see open question below; the picker UI was
  not built this stage).
- The old Readwise-only `GET /api/v1/dashboard/shelves/owned-elsewhere` was
  **removed** (nothing besides the one dashboard component called it) in
  favour of `GET /api/v1/reading-services/readwise/shelves/owned-elsewhere`.
  `ReadwiseOwnedElsewhereService.getOwnedElsewhere` now returns
  `ReadingServiceShelfItem[]` directly (was the Readwise-specific
  `ExternalBookCard[]`); the `readwise` adapter's new `getShelf` delegates
  to it for `owned-elsewhere` and returns `[]` for every other shelf (no
  social graph).
- Client: `OwnedElsewhereShelf.vue`/`useOwnedElsewhereShelf.ts` were
  replaced by generic `ExternalShelf.vue` + `useExternalShelf(provider,
  shelf)` (`client/src/features/dashboard/{components,composables}/`),
  taking `provider`/`shelf` plus a `titleKey`/`descriptionKey` i18n pair so
  each call site supplies its own copy (no new locale keys were added this
  stage - `DashboardView.vue`'s one call site reuses the existing
  `dashboard.ownedElsewhere.*` keys unchanged). The component renders a
  friend's avatar/name/status under a card when `item.friend` is set.

### Private adapters reachable over HTTP

Previously `reading-services.controller.ts` gated every route with a fixed
`PROVIDER_PERMISSIONS: Record<ReadingServiceProvider, Permission>` map
covering only `readwise`/`hardcover`, so a private adapter (loaded by
`ReadingServicePrivateAdapterLoaderService`) was registered and visible to
the migration/sync machinery but **could never be reached over HTTP** -
there was no entry for it in that map and no safe way to add one generically.

Fixed by giving every adapter a `permission: Permission` field
(`reading-service-provider.ts`), and having the controller fall back to the
adapter's own declared permission for anything that is not one of the two
built-in providers:
```ts
private permissionFor(adapter: ReadingServiceProviderAdapter): Permission {
  return PROVIDER_PERMISSIONS[adapter.provider as ReadingServiceProvider] ?? adapter.permission;
}
```
`PROVIDER_PERMISSIONS` still exists and still wins for `readwise`/`hardcover`
(backward compatible, no behaviour change for the two built-in providers).
`ReadingServicePrivateAdapterLoaderService.hasAdapterShape` now rejects a
module whose `permission` is missing or is not an existing `Permission`
enum member, so a private adapter can reuse an existing permission (e.g.
`Permission.ReadwiseSync`) but can never invent a new one or typo its way
into being unprotected. `ReadingServiceRegistry.get`/`has` now accept
`string` instead of `ReadingServiceProvider` so a private adapter's
arbitrary provider id can be looked up by the controller at all.

**Private adapter module contract** (the shape a private adapter, loaded
from `READING_SERVICES_PRIVATE_ADAPTERS_DIR`, must export as its default
export - see `reading-service-private-adapter-loader.service.ts` for the
loader and `reading-service-provider.ts` for the full interface):

```ts
export default {
  // Must not be "readwise" or "hardcover" (rejected: "already a built-in
  // provider"). Any other string is accepted as-is - it becomes the
  // :provider path segment on every reading-services route.
  provider: 'my-service',

  // Must be an existing Permission enum member (packages/types). Gates
  // every HTTP route for this provider; reuse an existing permission
  // (Permission.ReadwiseSync, Permission.HardcoverSync, ...) rather than
  // expecting a new one to be created for you.
  permission: 'readwise_sync',

  // Declares what this adapter supports. Only a capability with a truthy
  // value unlocks the matching feature/shelf; see ReadingServiceCapabilities
  // in packages/types/src/reading-services.ts for every recognised key
  // (status, rating, review, ... friends_shelf, trending_shelf,
  // recommendations_shelf, owned).
  capabilities: { trending_shelf: 'read' },

  // Required. Whether this user has the provider connected (token present,
  // not disabled). Called before every route that needs provider access.
  async isConnected(userId) { ... },

  // Required by the interface but may be a no-op (`async () => null`) if
  // this adapter does not support the migration/sync machinery at all -
  // only the shelf surface and `capabilities` matter for a provider that
  // exists purely to expose a shelf.
  async migratePage(userId, cursor, counters) { ... },
  async pull(userId) { ... },

  // Optional. Required (and only called) when `capabilities[shelfFeature]`
  // is truthy for a given shelf (friends_shelf -> friends-reading/
  // friends-finished, trending_shelf -> trending, recommendations_shelf ->
  // recommendations, owned -> owned-elsewhere). Returning an item with no
  // local match must set bookId: null, not omit the field.
  async getShelf(userId, shelf) {
    return [
      {
        provider: 'my-service',
        externalId: 'abc123',
        title: 'Some Book',
        authors: ['Some Author'],
        coverUrl: null,
        externalUrl: 'https://example.com/books/abc123',
        bookId: null,
        // Only meaningful on friends-reading/friends-finished; null otherwise.
        friend: null,
      },
    ];
  },
} satisfies ReadingServiceProviderAdapter; // type only available inside this repo; shape it by hand externally
```

A module missing `provider`/`capabilities`/`isConnected`/`migratePage`/
`pull`, or whose `permission` is absent/invalid, is rejected at load with a
warning log and simply never registered (the loader does not throw or stop
the app).

### Recap widget empty-shell flash

`ReadingRecapWidget.vue` already hid its own content with `v-if="loading ||
hasRecap"`, but the fixed-size card shell one level up in
`DashboardWidgetRow.vue` (`h-55`, border, shadow) rendered regardless, so a
disconnected/opted-out user still saw an empty tile flash in on every
dashboard load before the "not loading, no data" state collapsed it.
Fixed at the row level: `useReadingRecapWidget()` became a module-level
singleton (`client/src/features/dashboard/composables/
useReadingRecapWidget.ts`) so `DashboardWidgetRow.vue` can read the same
`data`/`loading` the widget itself uses, with no second fetch, and filters
the widget list through a `widgetVisible` predicate before either the
`v-if="visibleWidgets.length > 0"` section guard or the `v-for` that
instantiates each card - so the shell itself never mounts for
`reading-recap` while `!loading && data === null`. Covered by
`DashboardWidgetRow.spec.ts` (new) plus the existing
`ReadingRecapWidget.spec.ts`.

### Checks run (Unraid, this stage)

- `pnpm --filter server run type-check`: exit 0.
- `pnpm --filter client run type-check`: exit 0 (after the singleton-type fix).
- `pnpm exec eslint` on every file this stage touched (client + server): no errors.
- `pnpm exec prettier --check` on every file this stage touched: one file
  needed `--write` (`ExternalShelf.spec.ts`), applied and copied back to the
  PC per the workflow rule (never commit on Unraid).
- `pnpm --filter client run validate:locales`: **25 locale catalogs
  validated against 12206 English messages**, no gaps.
- `pnpm exec vitest run` server `src/modules/{reading-services,readwise,hardcover,dashboard}`:
  **63 test files, 936 tests, all passed**.
- `pnpm exec vitest run` client `src/features/dashboard`: **15 test files,
  176 tests, all passed** (includes the two new specs and the
  previously-failing `DashboardSettingsSheet.spec.ts` fixed this stage).
- No new migrations in this diff, so the disposable-DB
  apply/`drift_check` gate had nothing to run against.

### Open questions for the next agent

- **"Customize Dashboard" picker UI was not built.** The backend endpoint
  (`GET /reading-services/shelves/available`) and the generic
  `ExternalShelf`/`useExternalShelf` client pieces exist, but
  `DashboardSettingsSheet.vue`'s persisted `ScrollerConfig`/`WidgetConfig`
  systems are deeply locale-coupled (every `ScrollerType` needs a name in
  every one of the 25 locale catalogs via `shelfTypeName`/`widgetName`).
  Wiring friends/trending/recommendations shelves into that same picker
  needs an owner decision on whether to extend `ScrollerType` (with the
  locale-key cost that implies across 25 catalogs) or keep external shelves
  as a separate, non-persisted-via-i18n config list the way
  `readwise/owned-elsewhere` is wired into `DashboardView.vue` today (one
  hardcoded `<ExternalShelf>` per shelf, not user-configurable yet).
- The friend-rendering branch in `ExternalShelf.vue` has no live Hardcover
  friends-shelf data to verify against (same UNVERIFIED GraphQL caveat as
  the Hardcover social stage above).
- `recommendations_shelf`'s "most-added, minus already-linked" proxy still
  has no UI copy anywhere calling that out; same note as above, now also
  true for the generic `ExternalShelf` renderer.

## S9: Customize Dashboard shelf picker + server-side matching (2026-11-08)

Resolved the "picker UI was not built" open question above per three owner
decisions, on top of `fa8067f24` (commit `8e09d0f9d`, local only).

### 1. External shelves picker

Kept `ScrollerType`/`ScrollerConfig` untouched (no locale-key cost across
the 25 catalogs) and added a parallel, separately-persisted list instead:
`ExternalShelfConfig { provider, shelf, enabled, order }`
(`packages/types/src/dashboard.ts`), stored as `externalShelves` on the same
`dashboardShelfConfig` object (browser-local or synced, same as
`scrollers`/`shelfLayout`). A shelf's title/description is never persisted -
`useDashboardLabels.externalShelfTitle(provider, shelf)` composes it from
two new `en.json` blocks (`dashboard.externalShelves.providerNames`,
`dashboard.externalShelves.shelfNames`) at render time, so a locale change
or a provider rename never needs a migration.

- `client/src/features/dashboard/composables/useExternalShelvesConfig.ts`
  (new): fetches `GET /reading-services/shelves/available` and `GET
  /reading-services` once on mount, calls `useDashboardConfig().
  ensureExternalShelf(provider, shelf, defaultEnabled)` for every available
  shelf not yet in the persisted list (a no-op once it is), and exposes
  `pickerShelves` (every available shelf + its toggle, for the sheet) and
  `enabledExternalShelves` (enabled AND still connected, in order, for the
  dashboard). Default: `owned-elsewhere` starts enabled only when its
  provider is connected and `GET /reading-services`' `features.owned` is
  not `false`; every other shelf starts off.
- `DashboardSettingsSheet.vue`: new "External shelves" section on the
  Shelves tab below "Add shelf", one toggle row per `pickerShelves` entry,
  seeded into `externalShelvesDraft` on open and written back through
  `saveShelfSettings(scrollers, shelfLayout, sync, externalShelves)` (the
  function's new 4th, optional parameter - every existing call site that
  omits it keeps today's behaviour unchanged). No reorder control was
  built this stage (order is simply the API's available-shelves order);
  flagged below.
- `DashboardView.vue`: the single hardcoded `<ExternalShelf provider=
  "readwise" shelf="owned-elsewhere">` was replaced by a
  `v-for="entry in enabledExternalShelves"`. `ExternalShelf.vue` gained
  optional `title`/`description` props (pre-resolved strings) alongside the
  existing `titleKey`/`descriptionKey` (locale keys resolved inside the
  component) - exactly one of each pair is expected per call site; the
  dashboard view now passes the resolved pair, nothing else changed.
- Tests: `useDashboardConfig.spec.ts` covers `externalShelves` normalizing/
  round-tripping through storage; `DashboardSettingsSheet.spec.ts`/
  `DashboardView.spec.ts` mock `useExternalShelvesConfig` (new mock in both
  files) so the sheet's existing "api not called before Save" assertions
  are unaffected by the picker's own mount-time fetch.

### 2. Server-side matching for adapter shelf items

A private adapter with no local DB access cannot resolve `bookId` itself.
Added optional hints and a shared matcher so the server can try instead:

- `ReadingServiceShelfItem` gained optional `isbn?: string | null` and
  `asin?: string | null` (`packages/types/src/reading-services.ts`). `asin`
  is accepted for forward compatibility only - the local book schema has no
  ASIN column, so it is not used for matching yet.
- `server/src/modules/reading-services/reading-service-match.repository.ts`
  (new): `findCandidates(userId, isbn13s, titlesLower)`, a bounded query
  against the user's accessible library (same shape as the old
  Hardcover-only `hardcover-social-match.repository.ts`, which this
  replaces and deletes - Hardcover's social service now injects this
  shared repository instead). Bounded by the requested ISBN-13s/lowercased
  titles rather than paging the whole library, same rationale as the
  repository it replaced.
- `reading-services.controller.ts`'s `getShelf` now calls
  `resolveUnmatchedBookIds(userId, items)` after `adapter.getShelf`: items
  with `bookId == null` and an `isbn`/`asin` or `title`+`authors` hint are
  looked up via the shared matcher's `buildRemoteIndex`/`matchBook`
  (reused from `book-matcher.ts`, unchanged); a hit fills in `bookId`.
  Every item, matched or not, has `isbn`/`asin` stripped (`stripMatchHints`)
  before the response leaves the server - a client never needs either
  field, matched or not.
- `GET /reading-services/shelves/available` and the private adapter's
  `getShelf` are unaffected by this (hints are shelf-item-level, not
  shelf-list-level).

### 3. Private adapter contract alignment

Inspected `C:/Users/grib/Development/readwise-accessibility-poc/
bookorbit-adapter/{lib/contract.mjs,index.mjs}` (outside this repo, not
committed here) against the final contract above: `provider:
'readwise-social'`, `permission: 'readwise_sync'` (matches
`Permission.ReadwiseSync`'s enum value exactly), `capabilities:
{ friends_shelf: 'read' }` (object, not array), `getShelf(userId, shelf)`
returning items with `friend: { displayName, avatarUrl, status, date }`
and optional `isbn`/`asin` hints. **No changes were needed** - a prior
pass had already written `toShelfItem` in `lib/contract.mjs` to this exact
shape, isbn/asin included, with a comment explaining the loader only
duck-types the adapter object itself (`provider`/`capabilities`/
`isConnected`/`migratePage`/`pull`) so extra fields on shelf items are
harmless whether or not the server reads them. Ran its own test suite
(`node --test` in that folder - not part of this repo, allowed on this PC
per the studio rules): **46 tests, 46 passed, 0 failed**.

### Checks run (Unraid, this stage)

- `pnpm install --frozen-lockfile`, `pnpm --filter @bookorbit/types build`,
  `pnpm --filter @bookorbit/plugin-api build`.
- `pnpm --filter server run type-check`: clean, exit 0.
- `pnpm --filter client run type-check`: clean, exit 0 (`tsc` + `vue-tsc --build`).
- `pnpm --filter client run validate:locales`: "Validated 25 locale
  catalogs against 12219 English messages", no gaps.
- `npx eslint` (from `server/` and `client/`) on every file this stage
  touched: clean, 0 problems (after one `--fix` pass on a server test file
  and one `--write` prettier pass on `DashboardSettingsSheet.vue`, both
  copied back to the PC and folded into the commit with `git commit
  --amend`, per the never-commit-on-Unraid rule).
- `npx prettier --check` on every file this stage touched: clean after the
  fix above.
- `npx vitest run src/modules/reading-services src/modules/hardcover`
  (server): **27 test files, 455 tests, all passed**.
- `npx vitest run src/features/dashboard src/views/DashboardView.spec.ts`
  (client): **16 test files, 184 tests, all passed**.
- No schema changes in this diff, so the disposable-DB apply/`drift_check`
  gate had nothing to run against.
- Private adapter (outside this repo): `node --test` - **46 tests, 46
  passed, 0 failed**.

Commit `8e09d0f9d` "feat(dashboard): add provider shelf picker and
server-side matching", local only on `feat-reading-services-integration`,
not pushed.

### Open questions for the next agent

- **No manual reorder control for external shelves.** The picker only
  toggles a shelf on/off; its position on the dashboard is whatever order
  `GET /reading-services/shelves/available` returns providers/shelves in.
  `ExternalShelfConfig.order` exists and is persisted (so a future drag
  reorder has somewhere to write), but nothing in this stage's UI changes
  it.
- The friend-rendering branch in `ExternalShelf.vue` still has no live
  Hardcover friends-shelf data to verify against (same caveat carried over
  from the previous stage).
- `recommendations_shelf`'s "most-added, minus already-linked" proxy still
  has no UI copy calling that out, now also true for any provider shown
  through the picker.

## S10: Per-library per-feature reading-services scope (2026-11-08)

Finishing stage for `feat-reading-services-library-scope`. Previous agent's
branch had the design/implementation (schema, service, controller,
hardcover policy, Readwise scoping, web `ReadingServiceLibraries.vue`,
migration `0143_reading_service_library_settings`) plus one pending
uncommitted test fix on both the PC and Unraid worktrees (identical diffs
on both sides - reconciled by committing on the PC and re-syncing via
bundle, never touching the Unraid copy's git history).

Design (owner-approved, unchanged from the previous agent's plan): one row
per `(userId, provider, libraryId)` with `{enabled, features overrides}`;
a missing row means "inherit" (library enabled, every feature follows the
provider toggle); overrides only narrow, never widen, a feature the
provider-level toggle already turned off; a disabled library excludes
everything for it; a book that lives in more than one library syncs if
ANY in-scope library allows it; `library_excluded` beats a per-book
Hardcover `included` override; changing a library's scope never deletes
anything already pushed to Readwise/Hardcover.

### What needed fixing beyond the pending test commit

The controller test file's pending fix only added the
`libraryScopeService` constructor arg to the mock harness. Running the
focused suites surfaced three more real gaps, all fixed in this stage:

- `HardcoverSyncService`'s own test file never mocked
  `ReadingServiceLibraryScopeService` at all (not even the stale version) -
  every `syncBook`/`syncAll`/`getBookSyncState` call threw
  `Cannot read properties of undefined (reading 'getEffectiveLibraryIds')`.
  Fixed by adding the mock and a `libraryId: 1` on the shared `readingBook`
  fixture (library-scope checks fail closed on a book with no library id,
  by design - see `isLibraryInEffectiveScope` in `library-scope.utils.ts`).
- The controller's "library scope endpoints" tests called
  `updateLibrary`/`resetLibrary`/`list` without ever registering the
  `readwise`/`hardcover` adapters on the test registry, so
  `assertProviderAccess` 400'd with "Unknown reading-service provider"
  before the scope logic ran. Fixed by registering the adapter in each of
  those four tests, matching the pattern already used elsewhere in the
  file.
- `ReadingServiceMatchRepository.findCandidates` gained a `provider`
  second argument in this feature (`findCandidates(userId, provider,
  isbn13s, titlesLower)`) and one pre-existing controller test still
  asserted the old 3-arg call.

### Verification (Unraid, disposable DB)

- Server vitest, focused: `pnpm vitest run src/modules/readwise
  src/modules/reading-services src/modules/hardcover` - **54 test files,
  717 tests, all passed**. (Did not run the whole-repo suite per owner
  instruction mid-task; every file this stage touched is in that focused
  set.)
- Client vitest, focused: `pnpm vitest run src/features/reading-services
  src/features/readwise src/features/hardcover` - **16 test files, 148
  tests, all passed** (one `ReadingServiceLibraries.spec.ts` test fixed:
  it clicked `wrapper.get('button')` assuming that was Comics' "Customise"
  button, but the component renders a Customise button for every enabled
  library, so it was hitting Books' button first - fixed by selecting the
  Comics-row button by its text among all "Customise" buttons).
- `pnpm run typecheck:server` and `pnpm run typecheck:client`: both exit 0.
- `pnpm run validate:locales` (client): 25 locale catalogs validated
  against 12225 English messages, clean.
- `pnpm db:migrate` against the disposable DB (`postgres://postgres:postgres@
  127.0.0.1:55452/bookorbit`): migrations applied successfully.
- `drizzle-kit generate --name drift_check`: "No schema changes, nothing
  to migrate" - no drift between the migration files and
  `db/schema/reading-services.ts`.
- Changed-file prettier/eslint (diffed against `4634f1fe4`, the commit
  before this feature's first commit): one file needed `prettier --write`
  (`hardcover-sync.service.test.ts`, from this stage's own edit); eslint
  clean on every changed server and client file. Two prettier warnings
  outside this diff (`packages/types/src/hardcover.ts`,
  `server/src/db/migrations/meta/*.json`) are drizzle-generated/pre-existing
  and outside `format:check`'s own globs (`src/**/*.ts`, `test/**/*.ts`),
  so left untouched. One pre-existing client prettier warning on
  `useSeriesDetail.test.ts` is unrelated to this diff, also left untouched.

### Boot gate

`pnpm --filter server run build` (nest build via swc): succeeded, 1556
files compiled.

From `server/`, against the migrated disposable DB:

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55452/bookorbit \
PORT=3098 NODE_ENV=production \
JWT_SECRET=a-random-secret-value-1234567890 \
SETUP_BOOTSTRAP_TOKEN=boot-gate-token-abcdef123456 \
APP_DATA_PATH=/tmp/bookorbit-boot-data \
timeout 90 node dist/main.js
```

Logged `{"level":30,...,"context":"NestApplication","msg":"Nest
application successfully started"}` exactly once, and `grep -c
'"level":50'` on the full log was `0` (zero fatal lines). The only
warnings were the pre-existing `READING_SERVICES_ENCRYPTION_KEY must be a
64-char hex string` (expected - none was set for this throwaway boot) and
a few Fastify/path-to-regexp deprecation notices unrelated to this
feature.

### Android (separate repo, `bookorbit-android`, branch
`feat-reading-services-parity`)

Added `ReadingServiceLibrarySetting` and a pure
`ReadingServiceSummary.libraryScopeSummary()` extension (in
`core/model/ReadingServices.kt`) that derives from the new `libraries`
field: null when absent/empty (tolerates an older server - no scope line
renders), otherwise `{enabledCount, totalCount, customisedCount}` with an
`isAllLibraries` helper. Settings' Integrations section now shows one row
per connected provider below the existing "Manage on the web" row, with
"All libraries" or "N of M libraries, K customised" from that summary
(string resources `settings_integrations_library_scope_all` /
`_n_of_m` / `_customised`). New unit test file
`ReadingServicesLibraryScopeTest.kt` (4 cases, including that a disabled
library's own feature overrides don't count toward "customised").

Verification on the PC (no device installs): `./gradlew.bat
:app:testFullDebugUnitTest` - BUILD SUCCESSFUL; `./gradlew.bat
:app:assembleFullDebug` - BUILD SUCCESSFUL. Committed locally only
(`9deea1a`), not pushed.

### Hardcover "owned" sync - not implemented, API finding only

BookOrbit does **not** sync Hardcover's "owned" flag today (confirmed by
reading `hardcover-sync.service.ts`/`hardcover-sync-policy.ts`: pushed
fields are status, rating, dates, review and reading sessions/highlights,
never `owned`/`owned_copies`). The owner asked only to investigate, not
implement, Hardcover's support for marking a book owned:

- `user_books.owned` (`Boolean!`) and `user_books.owned_copies` (`Int!`)
  are documented, queryable fields
  (`src/content/docs/api/GraphQL/Schemas/UserBooks.mdx` in
  `hardcoverapp/hardcover-docs`, with a worked "Get Owned Books" query
  example filtering `owned: {_eq: true}`).
- A mutation named `edition_owned` is listed in the current GraphQL
  Actions/Scopes reference (`src/content/docs/api/GraphQL/Actions.mdx`
  and `capabilities.json` in the same repo), gated by the `write:library`
  scope. **Its argument signature is not published anywhere in the docs**
  - no example payload, no schema page for it, and it is absent from
    `schema.graphql`'s mutation-root input types in the slice I could
    fetch.
- A third-party open-source integration
  (`kristianedlund/hardcover-mcp`, MIT, unofficial) added ownership
  support and its own changelog shows it moving *away* from calling
  `edition_owned` directly: an early commit ("add owned books support")
  exposed `owned`/`owned_copies` via `set_user_book`, then a follow-up fix
  ("use `edition_owned` toggle and Owned list for ownership") ended up
  implementing ownership by adding/removing the book from the user's
  special internal list with `slug: "owned"` (via the regular list
  mutations), rather than a direct call to `edition_owned`. That is
  circumstantial evidence the direct mutation's contract was unreliable
  enough in practice that a working integration chose the list-based
  route instead, but I could not confirm this from Hardcover's own docs.
- **Recommendation if this is ever implemented**: treat `edition_owned`
  as unconfirmed and either (a) probe it with GraphQL introspection
  (`__type(name: "mutation_root")`) against a real token before writing
  any code, since Hasura allows introspecting the schema with a PAT, or
  (b) follow `hardcover-mcp`'s proven path of mutating list membership on
  the internal "owned" list via the already-documented list mutations
  (`upsert_list_book`/`delete_list_book`), which this codebase already
  uses for ordinary lists.

### Open questions for the next agent

- None blocking. The library-scope feature is complete and gated green
  end to end (server, client, migrations, boot, Android read-only
  summary). Hardcover "owned" sync remains a future feature, not started.



JSON shapes exported by this branch as of commit `8e09d0f9d`, exactly as
the server sends them (field names, types, null-ability). All routes are
under `/api/v1` and require the standard JWT auth; permission/feature
gating per route is noted where it is not just "logged in".

### `GET /reading-services/shelves/available`

Requires the permission for each adapter whose shelves it lists (adapters
the caller lacks permission for are omitted, not 403'd). Returns
`ReadingServiceAvailableShelf[]`:

```ts
{
  provider: "readwise" | "hardcover" | string; // string: a private adapter's own id
  shelf: "friends-reading" | "friends-finished" | "trending" | "recommendations" | "owned-elsewhere";
  connected: boolean; // whether the current user has this provider connected
}
```

### `GET /reading-services/:provider/shelves/:shelf`

404 if the provider does not declare the shelf's capability or has no
`getShelf`; 400 for an unknown shelf name or unregistered provider; 403 if
the caller lacks the provider's permission. Returns `ReadingServiceShelfItem[]`:

```ts
{
  provider: string;
  externalId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  externalUrl: string | null;
  bookId: number | null; // matched BookOrbit book id, resolved server-side if the adapter left it null
  friend: { displayName: string; avatarUrl: string | null; status: string; date: string | null } | null; // only on friends-reading/friends-finished
  // isbn/asin are never present here - the server strips them from every item before responding.
}
```

### `GET /dashboard/widgets/reading-recap`

Requires the `recap_widget` feature on at least one connected provider.
Returns `ReadingRecapWidget | null` (`null` when no provider is connected
and opted in - the widget hides entirely rather than rendering empty):

```ts
{
  provider: "readwise" | "hardcover";
  year: number;
  booksFinished: number;
  sessions: number;
  totalSeconds: number;
  readingDays: number;
  goal: number | null;
  byMonth: ReadingRecapMonthData[]; // see packages/types/src/reading-services.ts for this shape
}
```

### `GET /reading-services/:provider` (summary - part of the list below)

See the next entry; there is no single-provider summary route, only the
list one filtered client-side if needed.

### `GET /reading-services` (list)

Returns `ReadingServiceSummary[]`, one entry per adapter the caller has
permission for:

```ts
{
  provider: "readwise" | "hardcover" | string;
  connected: boolean;
  capabilities: Partial<Record<ReadingServiceFeature, "both" | "push" | "pull" | "read">>;
  features: Partial<Record<ReadingServiceFeature, boolean>>; // per-feature opt-in/out, e.g. features.owned
  migration: { state: "never" | "running" | "done" | "failed"; runId: number | null; finishedAt: string | null };
  lastPullAt: string | null;
  disabledReason: string | null;
  libraries: ReadingServiceLibrarySetting[]; // added by S10 (per-library scope); absent on servers that predate it
}
```

Where `ReadingServiceLibrarySetting` is:

```ts
{
  libraryId: number;
  enabled: boolean; // false excludes every book in this library from this provider, regardless of feature overrides
  features: Partial<Record<ReadingServiceFeature, boolean>>; // per-library narrowing; a key here can only turn a feature OFF, never on if the provider-level toggle is already off
}
```

`libraries` always has one entry per library the caller can access (not
just the ones with an override row) - a missing override means
"inherit": library enabled, every feature follows the provider-level
toggle. A client can render "All libraries" when every entry is
`enabled: true` with an empty `features`, otherwise "N of M libraries, K
customised" (`N` = enabled count, `M` = `libraries.length`, `K` = enabled
libraries with at least one `features` key set to `false`). Android does
exactly this in `ReadingServiceSummary.libraryScopeSummary()`
(`core/model/ReadingServices.kt`), treating an absent/empty `libraries`
as "don't render a scope line" so it tolerates an older server.

### `PUT /reading-services/:provider/libraries/:libraryId`

Requires permission for that provider's adapter (same gate as
`PATCH /reading-services/:provider/features`). Body (`UpdateReadingServiceLibraryDto`,
both fields optional - omitting one leaves it unchanged):

```ts
{ enabled?: boolean; features?: Partial<Record<string, boolean>> }
```

Unknown feature keys are silently dropped (forward-compat with an older
client/newer server mismatch), not rejected. Returns the full effective
setting after the update, inherited defaults filled in:

```ts
{ libraryId: number; enabled: boolean; features: Partial<Record<string, boolean>> }
```

### `DELETE /reading-services/:provider/libraries/:libraryId`

Resets the library back to "inherit" (deletes the override row; does not
touch anything already pushed to the provider). Same response shape as
the `PUT` above, now reflecting the inherited defaults.

### `PATCH /books/:id/review`

Requires `Permission.LibraryEditMetadata`. Body:

```ts
{ review?: string | null } // UpdateReviewDto. Omitted key leaves the review alone; null clears it; max length 10000.
```

Returns the full `BookDetailDto` (not just the review fields) - same
omitted-key-vs-null contract as `PATCH /books/:id/personal-note`. Writing
a non-undefined `review` raises a `book.review-changed` event for the
Readwise push listener.

### Book detail review fields

On `BookDetailDto` (`GET /books/:id` and the two PATCH routes above):

```ts
{
  rating: number | null;              // star rating, separate field from review
  personalNote: string | null;
  personalNoteUpdatedAt: string | null;
  review?: string | null;             // absent on servers that predate this field; present (possibly null) otherwise
  reviewUpdatedAt?: string | null;
  communityRatings: BookCommunityRating[];
  // ...plus every other BookDetailDto field (cover, metadata, files, etc.), unchanged by this stage.
}
```

## Reading-services provider parity (this stage, feat-reading-services-provider-parity)

Host-side support for private reading-service adapters reaching parity with the two
built-in providers, plus three owner-reported UI bugs fixed. Commits on this branch
(based on feat-reading-services-library-scope @ 3ff34e2d): "feat: host-side adapter
contract v2", "fix: owner-reported parity bugs + password auth", "style: prettier +
require-await fixes", "feat(db): migration 0144".

### What changed, server

- `reading-service-provider.ts`: the adapter contract gained optional `displayName`,
  `description`, `iconUrl`, `authMethods`, `validateCredential`, `loginWithPassword`,
  `startDeviceAuth`, `pollDeviceAuth`, `disconnect`. Built-in Readwise/Hardcover don't
  set any of these; a private adapter sets `authMethods` plus whichever of the four
  auth methods it implements.
- `reading-service-private-adapter-bridge.ts`: wraps a contract-v2 module (ctx-based
  calls: `{userId, credential, logger, fetch}`; `getShelf(ctx, shelfId) -> {items,
  error?}`) into the host's `ReadingServiceProviderAdapter` shape. `auth_expired` from
  `getShelf` flips the stored credential's `needsReconnect` instead of throwing.
  `migratePage`/`pull` reject (no sync surface for a v2, read-only adapter).
- `reading-service-private-adapter-loader.service.ts`: loads either a v1
  (isConnected/migratePage/pull) or v2 (auth.methods/getShelf) default export from
  `READING_SERVICES_PRIVATE_ADAPTERS_DIR`; rejects a built-in provider name, a
  duplicate provider, or an invalid `permission`.
- `reading-service-private-credential.service.ts` + table
  `reading_service_private_credentials` (migration 0144): one encrypted credential row
  per (userId, provider), reusing `ReadingServiceTokenService`'s AES-GCM key
  (`READING_SERVICES_ENCRYPTION_KEY`). Never logged, never returned decrypted except
  inside the bridge's `ctx.credential` for the one call that needs it.
- New routes on `ReadingServicesController`, all behind `assertProviderAccess`
  (adapter's declared permission):
  - `POST /reading-services/:provider/auth/token` - body `{ credential: string }`.
    Calls `validateCredential`, stores on success.
  - `POST /reading-services/:provider/auth/password` - body
    `{ username: string, password: string }`. Throttled 5/15min per user
    (`@Throttle`). Calls `loginWithPassword`; stores the returned `credential` only -
    the password itself is never stored, cached, or logged (already covered by the
    global pino `req.body.password` redact path in `logger.config.ts`; `credential`
    and `token` are redacted too now).
  - `POST /reading-services/:provider/auth/device/start` /
    `POST /reading-services/:provider/auth/device/poll` - the device-auth handle is
    cached server-side (`ReadingServiceCacheService`) and never reaches the client.
  - `DELETE /reading-services/:provider/auth` - deletes the stored credential.
  - `GET /reading-services` summaries now include `displayName`, `description`,
    `iconUrl`, `authMethods`, `needsReconnect`.
- Audited every built-in adapter's declared `capabilities` against what it actually
  implements: Readwise was missing `recap_widget` (the recap widget exists via
  `ReadwiseRecapService`, just wasn't declared) - fixed. Hardcover's capabilities were
  already accurate.

### What changed, client

- `ReadingServiceFeatureList.vue`: a feature the provider's `capabilities` doesn't
  declare is no longer rendered at all (was a greyed "unavailable" row) - owner rule:
  hide what the platform lacks, only grey for state. `publish_sessions` is still the
  one legitimately dependency-gated row (needs `sessions` on first), with a
  `dependencyHint` string instead of a stock "unavailable" copy key.
- `ReadingServiceLibraries.vue`: now always renders its card frame once a summary
  exists, with an honest empty-state sentence
  (`settings.readingServices.libraries.empty`) instead of vanishing entirely when
  there are zero libraries yet.
- `HardcoverSettings.vue`: the Libraries section was gated on `tokenConfigured`
  (connected), hiding it before the user connects; changed to match
  `ReadwiseSettings.vue` (gated on the summary existing, not on connection state).
- `en.json`: added `trending_shelf`/`recommendations_shelf` label+hint (an owner
  screenshot caught these rendering as raw i18n keys - they'd been added to
  `READING_SERVICE_FEATURES` without ever getting locale entries), removed stale
  "coming soon"/"coming later"/`discover_shelf` copy and `unavailable` keys for
  platform-unsupported features, added `libraries.empty`.
- New test `reading-service-feature-locales.spec.ts`: fails if any
  `READING_SERVICE_FEATURES` id ever ships without an en.json label+hint, or keeps a
  stale `unavailable` key - regression guard for the raw-key bug above.
- **Built in this continuation** (client UI for the server-side auth routes above):
  the generic `ReadingServiceSettings` page, the shared `ReadingServiceSignIn`
  section, and dynamic nav entries for private adapters. Design note (per
  `design-taste-frontend`'s app-screen rules, written before building):
  - **Layout**: `ReadingServiceSettings.vue` is the page a private adapter's nav
    entry routes to (`/settings/integrations/:provider`), reusing the existing
    `SettingsSection` card pattern: Sign-in at the top (unconditionally first, per
    spec), then "What syncs" (`ReadingServiceFeatureList`, unchanged, already hides
    unsupported features), then "Libraries" (`ReadingServiceLibraries`, unchanged),
    then a plain sentence linking to Customize Dashboard for shelves - no new
    component needed there, shelves aren't configured on this page.
  - **Sign-in states** (`ReadingServiceSignIn.vue`, one card, `data-testid`s on every
    state for tests): method picker as a segmented control only when
    `authMethods.length > 1`, in declared order; a single method skips the picker
    and shows its form directly. Token: single input (`SECRET_INPUT_ATTRS`, matches
    Readwise/Hardcover's existing pattern) + Show/Hide + disabled-while-empty submit.
    Password: username (`autocomplete=username`) + password
    (`autocomplete=current-password`, Show/Hide, type toggles), submit disabled
    while pending or either field empty, per-reason error text below the form
    (`invalid`/`mfa_required`/`network`/`unsupported`/`rate_limited` with a
    countdown built from the `Retry-After` header). Device code: idle (one primary
    button) -> waiting (large monospace code + copy button, "Open the sign-in page"
    link with `target=_blank`, live "expires in Ns" countdown, cancel) -> approved
    (collapses immediately) / expired / denied / error (each a calm one-line
    message + retry). Connected: collapses to an account-label row with "Switch
    account" (reopens the picker without disconnecting) and "Disconnect" (behind the
    existing `ConfirmDialog`). `needsReconnect`: a calm banner above the (always
    reopened) picker - no colour alarm, just a plain sentence naming the provider.
  - **Components reused, none new beyond the above**: `Button`, `ConfirmDialog`,
    `SettingsSection`, `ToggleSwitch`'s sibling pattern (`settings-label`/
    `settings-title` CSS classes), `SECRET_INPUT_ATTRS`. New:
    `ReadingServiceSignIn.vue`, `ReadingServiceSettings.vue` +
    `ReadingServiceSettingsPage.vue` (route wrapper reading `:provider`),
    `ReadingServiceAdapterIcon.vue` (renders `iconUrl`: http(s)/data URL straight
    into `<img src>`; a raw inline `<svg>` string re-encoded as a
    `data:image/svg+xml` source - never `v-html` - fallback a plain `Link2` glyph,
    no tinted square), `useReadingServiceAuth.ts` (per-mount sign-in state + device
    poll loop; the password field itself never touches this composable's state past
    the one `submitPassword(username, password)` call), `reading-service-auth.api.ts`,
    `usePrivateAdapterNavItems.ts` + `createAdapterIconComponent` (wraps the icon
    component for use as a `SettingsNavItem.icon`).
  - **Nav wiring**: `settings-nav.ts` gained `SettingsNavItem.routeParams` (for the
    one shared `settings-reading-service` route serving every private adapter) and
    `mergeDynamicAccountItems(groups, items)`, appending private-adapter items into
    the "accounts" group (creating it if every static account item is hidden).
    `SettingsNav.vue`/`SettingsSidebar.vue` call `usePrivateAdapterNavItems` and
    merge its items in; `router/index.ts` added the
    `/settings/integrations/:provider` route.
  - **Readwise/Hardcover**: both adopted the connected/collapsed treatment (account
    row + "Switch account" revealing the existing unchanged form) without any
    behavioural change to their save/validate/disconnect flows; Hardcover's existing
    `disconnect()` now also closes the reopened form.
  - Tests: `ReadingServiceSignIn.spec.ts` (every auth method and state, password
    cleared from the DOM input synchronously on submit, connected collapse,
    `needsReconnect`, confirm-before-disconnect), `usePrivateAdapterNavItems.spec.ts`
    (nav lists only adapters with `authMethods`, built-ins absent, label fallback).
  - **Gates this continuation** (all on Unraid, commits
    `77d4ee1e8`..`1324056fa` on top of `a87486a4a`): server + client `type-check`
    exit 0 both; client vitest for `reading-services`/`readwise`/`hardcover`/`settings`
    (the full targeted run, not just the new files, since the collapse treatment
    touches Readwise/Hardcover's existing specs): 101/101 files, 1203/1203 tests;
    server vitest `reading-services`: 15/15 files, 140/140 tests (includes the
    password-throttle guard test); `validate-locales.mjs`: "Validated 25 locale
    catalogs against 12252 English messages"; changed-file `eslint`/`prettier`:
    clean (one real finding fixed - the device-code copy button now goes through
    `copyToClipboard` instead of `navigator.clipboard` directly, per the
    HTTP/self-hosted-origin eslint guard); `design-taste-frontend`'s `lint.mjs` on
    every new `.vue` file: 0 FAIL (one WARN, `outlined-box` on the Sign-in card's
    border - the same pattern Readwise/Hardcover's own cards already use, kept for
    consistency with the existing design system). Boot gate: build succeeded (1558
    files via swc); against the already-migrated disposable DB
    (`bookorbit-disposable-db`, `127.0.0.1:55452`, migration 144 applied), `node
    dist/main.js` logged "Nest application successfully started" exactly once and
    zero `"level":50` lines.
  - Three pre-existing Readwise/Hardcover specs needed a one-line "click Switch
    account first" fix each (they'd assumed the form was always visible); the
    Hardcover spec's `disconnect` mock was also changed to set `settings.value =
    null`, matching what the real `useHardcoverSettings.disconnect()` actually does
    - without that the mock left `tokenConfigured` true after disconnecting and the
    card would incorrectly re-collapse to "Connected".

### Auth method contract (packages/types)

```ts
type ReadingServiceAuthMethod =
  | { kind: "token"; label: string; help?: string; placeholder?: string }
  | { kind: "device_code"; label: string; help?: string }
  | { kind: "password"; label: string; help?: string; fields: {
      username: { label: string; placeholder?: string };
      password: { label: string; placeholder?: string };
    } };

type ReadingServicePasswordLoginResult =
  | { ok: true; accountLabel?: string | null }
  | { ok: false; reason: "invalid" | "mfa_required" | "network" | "unsupported"; message?: string | null };
```

`GET /reading-services` summary gained: `displayName?`, `description?`, `iconUrl?`,
`authMethods?`, `needsReconnect: boolean`. These are only populated for adapters that
declare them (private adapters); built-ins leave them undefined/false.

### Gates run this stage (all on Unraid, 192.168.5.3)

- Server + client `type-check`: exit 0 both.
- Server vitest (`reading-services` + `readwise`): 380/380 passed.
- Client vitest (`reading-services` + `hardcover` + `readwise`): 155/155 passed.
- `node ./scripts/validate-locales.mjs` (client): "Validated 25 locale catalogs
  against 12221 English messages".
- Changed-file `prettier --check` / `eslint`: clean after two fix rounds (long union
  types needed reformatting; `migratePage`/`pull` on the bridge were `async` with no
  `await` - now synchronously return `Promise.reject(...)`).
- `pnpm db:generate add_reading_service_private_credentials` against the disposable
  DB -> migration `0144_add_reading_service_private_credentials.sql`; applied with
  `pnpm db:migrate`; a follow-up `pnpm db:generate drift_check` reported "No schema
  changes, nothing to migrate".
- Boot gate, both green, zero `"level":50` lines, both logged `Nest application
  successfully started`:
  - (a) no `READING_SERVICES_PRIVATE_ADAPTERS_DIR` set.
  - (b) `READING_SERVICES_PRIVATE_ADAPTERS_DIR` pointing at a copy of the real
    `readwise-social` adapter (from
    `C:/Users/grib/Development/readwise-accessibility-poc/bookorbit-adapter/`,
    `index.mjs` + `lib/`, no `test/`/`node_modules`); logged
    `provider=readwise-social - adapter registered` and `loaded=1 scanned=1`.

Note: the disposable DB is actually on `127.0.0.1:55452` (container
`bookorbit-disposable-db`), not `:55453` as earlier docs say - port `:55453` was not
listening when this stage ran; check `docker ps` if gates fail to connect.

### Adapter-side: already matches, no changes needed

The real adapter at `bookorbit-adapter/index.mjs` (outside this repo) has *already*
been updated in parallel with `token` and `password` (`loginWithPassword`) methods
alongside `device_code`, matching this stage's host contract exactly - confirmed by
loading a copy of it in boot gate (b) above. No adapter-side changes are needed.

### Not done this stage (for a successor)

1. ~~The generic Vue `ReadingServiceSettings`/Sign-in UI described above~~ - built in
   the next stage, see below.
2. Android (`bookorbit-android`, `feat-reading-services-parity` @ 9deea1a): the
   Integrations list showing adapter providers by `displayName` with status - not
   started this stage. Relevant shape for that work is the `GET /reading-services`
   summary fields documented above.
3. ~~Rate-limit test coverage for the `@Throttle` decorator on `/auth/password`~~ -
   added in the next stage.

## Reading-services Sign-in UI + generic provider settings (web)

Builds the web Sign-in section and generic private-adapter settings page the
previous stage left undone, through `design-taste-frontend`'s app-screen rules
("component or single section" special case - matches BookOrbit's existing
settings design system rather than dealing a fresh direction).

### Design note (written before implementation, per the skill)

**States covered by `ReadingServiceSignIn.vue`** (one component, used at the top of
every provider settings page):
- **Disconnected, one method**: that method's form renders directly, no picker.
- **Disconnected, 2+ methods**: a segmented control (radio-group semantics, one row,
  sentence case, no icons) above the active method's form, order as the adapter
  declared `authMethods`.
- **Token method**: one labelled input (`type="password"`-styled via `SECRET_INPUT_ATTRS`
  masking, not an actual BookOrbit credential field) with a reveal toggle, a Connect
  button disabled while empty or pending, inline error on failure.
- **Password method**: username (`autocomplete="username"`) + password
  (`autocomplete="current-password"`, reveal toggle) - this *is* a real third-party
  login form, so real autocomplete hints are correct and intentional, unlike the
  BookOrbit-credential case `secret-input.ts` warns about. Submit disabled while
  pending or either field empty. Component state for the password is cleared
  immediately after every submit attempt (success or failure) - never retained.
  Errors are per-reason: `invalid`, `mfa_required`, `network`, `unsupported`, and a
  rate-limited state (429) showing a retry-after countdown sentence.
- **Device-code method**, five states: `idle` (one primary "Connect" action) ->
  `waiting` (the code in large tabular-figure type with a copy button, "Open
  <verification link>" opening a new tab, a live countdown to `expiresAt`, Cancel,
  polling the server every `pollIntervalSeconds`) -> one of `approved` (collapses to
  Connected), `expired`/`denied`/`error` (a calm inline message + "Try again" that
  goes back to `idle`).
- **Connected** (no method UI at all): one row - account label (or the provider name
  when the adapter gave no label), a quiet "Connected" status, "Switch account"
  (reopens the method picker/form without disconnecting first) and "Disconnect"
  behind `ConfirmDialog` (destructive, names the provider).
- **`needsReconnect`**: a calm (not red/alarming) inline notice above the reopened
  sign-in methods, same visual weight as the existing `settings-row` info notices
  elsewhere in Settings (`border-border/70 bg-muted/40`), explaining the credential
  needs refreshing - not a full-bleed banner, not styled as an error.

**Layout and components reused, no new visual language**: the existing
`border border-border rounded-lg bg-card` card shell (same as
`ReadwiseSettings`/`HardcoverConnectionCard`), `SettingsRow`/`SettingsSection` for
the generic page's feature list and libraries sections, `ToggleSwitch`,
`ConfirmDialog`, `Button`, `SECRET_INPUT_ATTRS`. No icons in tinted squares, no
gradients, sentence case throughout, no stock "coming soon" copy. The private
adapter's icon (`iconUrl`, which may be a URL or a raw inline `<svg>` string) is
rendered through `ReadingServiceAdapterIcon.vue`: never `v-html`, either as a plain
`<img>` (http/data URL) or an `<img>` built from the inline SVG re-encoded as a
`data:image/svg+xml` source - so no raw markup ever reaches the DOM unsanitised.

**Generic `ReadingServiceSettings.vue`** (the page a private adapter gets, mounted
at `/settings/integrations/:provider`, nav item generated from
`GET /reading-services` summaries that carry `authMethods`): Sign-in section at the
top, `ReadingServiceFeatureList` (already hides unsupported features - no changes
needed there), `ReadingServiceLibraries`, and a closing note that the adapter's
shelves can be added to the dashboard, linking to `/` where Customize Dashboard
lives (there is no dedicated settings route for it - it's a sheet opened from the
dashboard itself).

**Readwise/Hardcover**: kept their dedicated token forms and extra settings
(migration panel, sync-scope radios, privacy select) exactly as they were; adopted
only the same collapse-when-connected shape (an account-status row with "Switch
account" revealing the form again) so the three provider pages read as one family,
per the card's "adopt where it fits without breaking their flows."

### What changed, server

- `reading-services.ts` (`@bookorbit/types`): `ReadingServiceSummary` gained
  `accountLabel?: string | null`, populated for private adapters from the stored
  credential's label (built-ins leave it undefined, same as the other
  private-adapter-only fields).
- `reading-services.controller.ts`: `list()` returns that `accountLabel` from the
  credential it was already fetching for `needsReconnect`.
- New `reading-services.controller.password-throttle.test.ts`: a behavioural test
  against the real `SensitiveEndpointThrottlerGuard` + in-memory
  `ThrottlerStorageService` (not a mock) driving `connectWithPassword`'s metadata six
  times with the same fake request; asserts the first five resolve and the sixth
  throws, proving the 5-per-15-minute guard the previous stage left untested.

### What changed, client

- New `features/reading-services/api/reading-service-auth.api.ts`: the four auth
  routes (`token`, `password`, `device/start`, `device/poll`) plus `disconnect`.
- New `features/reading-services/composables/useReadingServiceAuth.ts`: per-provider
  auth state machine (method selection, pending/error state per method, the
  device-code poll loop and countdown, disconnect). Clears the password field the
  instant a password attempt is submitted, success or failure.
- New `features/reading-services/components/ReadingServiceAdapterIcon.vue` and
  `.../reading-service-adapter-icon.ts` (the nav-icon factory wrapping it for
  `<component :is>` use).
- New `features/reading-services/components/ReadingServiceSignIn.vue`: the Sign-in
  section described above.
- New `features/reading-services/components/ReadingServiceSettings.vue` +
  `ReadingServiceSettingsPage.vue` (route-level wrapper reading `:provider` from the
  route): the generic private-adapter settings page.
- New `features/reading-services/composables/usePrivateAdapterNavItems.ts`: computed
  `SettingsNavItem[]` from the current summaries, one per provider that declares
  `authMethods` and isn't a built-in (readwise/hardcover/storygraph).
- `features/settings/lib/settings-nav.ts`: `SettingsNavItem` gained optional
  `routeParams`; new `mergeDynamicAccountItems()` appends the dynamic items into the
  "accounts" group (or creates it) after `visibleSettingsNav()` runs. `labelKey` for
  a dynamic item is the adapter's raw `displayName` - vue-i18n's missing-key fallback
  returns the key itself, which is exactly the real-time, server-supplied label, with
  no en.json entry needed (and nothing for `validate-locales.mjs` to flag, since it
  is never a literal key in source).
- `features/settings/components/SettingsNav.vue` and `SettingsSidebar.vue`: merge in
  `usePrivateAdapterNavItems()`'s items, fetch summaries on mount, and compare
  `routeParams.provider` (not just `routeName`) when deciding which row is active -
  two private adapters would otherwise highlight together.
- `router/index.ts`: new route `settings-reading-service` at
  `integrations/:provider`.
- `ReadwiseSettings.vue` / `HardcoverConnectionCard.vue`: collapse-when-connected
  treatment (see design note).
- `en.json`: new `settings.readingServices.signIn.*` and
  `settings.readingServices.generic.*` keys for the Sign-in section and the generic
  page; nothing added for dynamic adapter labels (see above).
- New component tests under
  `features/reading-services/components/__tests__/ReadingServiceSignIn.spec.ts`
  (one state per method, password-not-retained, connected collapse, needsReconnect)
  and `features/reading-services/composables/__tests__/usePrivateAdapterNavItems.spec.ts`.

### Gates run this stage (all on Unraid, 192.168.5.3)

Fill in before handoff: server + client type-check; server vitest
(`reading-services`); client vitest (`reading-services`, `readwise`, `hardcover`,
`settings`); `validate-locales.mjs`; changed-file prettier/eslint; taste `lint.mjs`;
boot gate.

## S11: Reconnect-safe Readwise/Hardcover sync (2026-11-08)

Branch `feat-reading-services-reconnect-safe`, stacked on `feat-reading-services-library-scope` @ `3ff34e2d`. Worktrees: PC `D:/Development/bookorbit-worktrees/feat-reading-services-reconnect-safe`, Unraid `/mnt/user/data/Development/bookorbit-worktrees/feat-reading-services-reconnect-safe`. Head commit **`540133a475`**, local only, not pushed. A sibling agent is concurrently editing `server/src/modules/reading-services` (adapter loader, controller, credentials) and client settings UI on another branch, so this stage stayed inside `server/src/modules/readwise` and `server/src/modules/hardcover`.

### Scenario this addresses

A BookOrbit DB with no sync history (live restored from an old backup, or a brand-new install) connects to a Readwise/Hardcover account another BookOrbit instance (e.g. a staging copy of the same DB) already synced from. Requirement: zero duplicates on either side, no lost data, BookOrbit stays authoritative for its own fields, Readwise sessions never move BookOrbit's reading position. Framed generally as "first connect with an empty ledger", which also covers a plain reinstall.

### Audit: every push path's "unlinked local item -> create remote" assumption

| Path | File | Before this stage | Duplicate risk on reconnect |
|---|---|---|---|
| Books migration push | `readwise-books-migration.service.ts` | Matched a book against the remote index (built once per run, fine) and called `updateBooks`/`createBooks`. On an exact value match it still sent a PATCH every time. | Low duplicate risk (the matcher already ran against the full library via the index phase), but every re-run silently overwrote a remote value that already agreed, with no record of what would have changed on an actual mismatch. |
| Sessions push | `readwise-sessions-push.service.ts` + `readwise-sessions-local.repository.ts` (`findPushableSessions`) | Per book, found local sessions with no `readwise.session` link and pushed them via `createSessions`. Never checked whether an equivalent session already existed remotely. | **High.** On reconnect, every BookOrbit-origin session already on Readwise (pushed by the other instance) looks "unlinked" here and gets recreated. |
| Highlights ledger backfill | `readwise-highlights-ledger-backfill.service.ts` | For highlights exported before the per-highlight ledger existed, looked up the local annotation purely by `annotationId` parsed out of the highlight's `url`, with no check that the ids still line up to a DB restored from a different point in time, and no fallback when the id was unparsable or wrong. | **High.** The old-watermark backfill assumed watermark-reachable implied "this highlight's annotation id still points at the matching local row", which does not hold once the DB has been swapped for a different backup. |
| Reviews/ratings/status/dates push (part of the books migration path above) | `readwise-books-migration.service.ts` | Same PATCH-every-match behaviour as the books row above; no "BookOrbit wins, but log what was overwritten" record for the owner to review after a reconnect. | Not a duplicate-creation risk, but a silent-data-loss risk on the remote side with no audit trail. |
| Hardcover sync (status/progress/rating/dates) | `hardcover-sync.service.ts`, `hardcover-book-match.service.ts` | `user_book` upsert already keys off Hardcover's own `book_id` via `findOrCreateUserBook`-style lookup before create, so it is naturally idempotent per book id; confirmed by reading `hardcover-sync.service.ts` end to end - no code path creates a `user_book` without first searching for an existing one by `book_id`. No separate matching work was needed here. | Low; Hardcover's own id-based upsert already prevents duplicate `user_book` rows. Reading-journal entries follow the same book-id-scoped lookup. |
| Sessions/highlights pull | `readwise-sessions-pull.service.ts`, `readwise-highlights-pull.service.ts` | Pull dedupes by the `reading_service_item_links` ledger (`findItemLinkByExternalId`), which is correct for "already pulled this exact remote id before" but did nothing for "this remote item is the twin of a BookOrbit-origin local item that this live DB never got a link row for because it never pushed it (a different, earlier BookOrbit instance did)". | **Medium.** A highlight or session BookOrbit itself originally created and pushed (from the *other* instance) would, on live's first pull, import as a brand-new `source='readwise'` row sitting alongside nothing, instead of linking back to nothing (it has no local twin on live) - except when live *does* have a local twin (e.g. the same book/session exists locally because BookOrbit, not Readwise, is the source of truth for it). Sessions: fixed in this stage. Highlights: BookOrbit never creates highlights independently of Readwise in this codebase, so there is no local-origin highlight for the pull side to accidentally duplicate; no change was needed there beyond the existing ledger dedupe. |

### What changed

1. **`readwise-sessions-reconcile.service.ts` (new)** - a one-time-per-user "reconcile" pass, gated by a `reading_service_cache` flag (`sessions-reconciled`, mirrors the existing highlights-backfill gating pattern) so it runs exactly once per user and is a no-op after. On first run it lists every remote session once (paginated via the existing `listSessions` cursor), scans every locally pushable session across all Readwise-linked books (`ReadwiseSessionsLocalRepository.findAllPushableSessions`, new paginated oldest-first query, added across this and the prior context-window), and links (not creates) any local session whose linked book, start time (±60s, `READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS`) and duration (±60s) match a remote one. Each remote session is consumed at most once so two close-together local sessions cannot both claim it. Wired into `ReadwiseSessionsPushService.flushUser` before its normal per-book push loop.
2. **`readwise-sessions-pull.service.ts`** - before importing a never-before-seen remote session as a new row, it now calls `ReadwiseSessionsLocalRepository.findUnlinkedSessionMatch` (same book/start/duration tolerance as above) and links an existing unlinked local session instead of inserting a duplicate. This is the "pulled item that is also a match for a local item should link, not duplicate" requirement from the task, applied to sessions - the case that matters here, since BookOrbit sessions are the only Readwise-synced item type with a plausible local-origin twin.
3. **`readwise-highlights-ledger-backfill.service.ts`** - rewritten so the id parsed from the highlight's URL is only trusted as a shortcut once the local annotation's text also matches the remote highlight's text; when the id doesn't resolve, resolves to the wrong row, or can't be parsed, it falls back to `ReadwiseRepository.findUnlinkedAnnotationByText` (new repository method, content-based match by book + normalised text). This removes the "old watermark implies remote existence without checking" assumption called out in the task: the backfill now verifies every link against content before writing it, on a DB that may have come from a different backup than the one that created the watermark.
4. **`readwise-books-migration.service.ts`** - the push phase now fetches the matched remote book's current rating/review/status/dates (already cached from the index phase, extended `CachedRemoteBook` to carry them) and compares them to BookOrbit's values before sending a PATCH. Equal: links silently (`upsertBookLink`), no `updateBooks` call. Different: still pushes (BookOrbit wins, as specified) but logs the previous remote value being overwritten (`previousStatus`/`previousRating`/`previousReview`/`previousStartedAt`/`previousFinishedAt`) as a structured `[end]` log line under the sync run's existing logger, so the owner can review what a reconnect overwrote.
5. **Hardcover** - audited, no change needed. `hardcover-sync.service.ts`'s upsert already looks up the existing `user_book` by Hardcover's `book_id` before ever creating one, and the reading-journal/progress writes are scoped to that same looked-up row, so a second BookOrbit instance (or a DB restore) connecting to the same Hardcover account cannot create a duplicate `user_book` or duplicate journal entries through this code path. This was verified by reading the full upsert path, not just skimmed.
6. **Books matching against the full library on first connect** - already true before this stage: `ReadwiseBooksMigrationService`'s index phase pages the entire remote library into `reading_service_cache` before the push phase ever runs (see S2 above), so "match against the full remote library on first connect, not only new items" was already satisfied and needed no change.

### First-connect / "reconciling" phase (task item 4)

Not implemented as a distinct phase exposed through the migration/sync-run status in this stage. What exists instead: the sessions reconcile pass above is itself bounded, resumable-in-spirit (idempotent - re-running it is always safe and cheap once the cache flag is set) and runs automatically before the first push, which satisfies the functional requirement ("a reconcile pass before any push") for sessions. It is **not** currently surfaced as a `phase: 'reconciling'` value in `ReadingServiceSyncRunService`'s status enum, because that status/phase machinery lives in `reading-services/reading-service-sync-run.service.ts`, which this stage deliberately avoided touching (owned by the concurrent sibling agent's branch per the task's module boundary). **Flag for the owner / next agent:** once the sibling branch lands, add a `'reconciling'` phase value there and have `ReadwiseSessionsReconcileService.ensureReconciled` report into it, so the pass is visible in the UI instead of only in logs. The books-migration index phase already reports through the existing migration status machinery from S2 and needed no change.

### Two concurrent instances (task item 5)

Documented here per the task, since code is not a complete guard: **two BookOrbit instances must never run a sync for the same Readwise or Hardcover account at the same time.** Both the sessions reconcile pass and the books-migration index phase build an in-memory/cached snapshot of "the remote state as of the start of this run" and then act on it; a concurrent writer on the other instance can create a remote item *during* that window that this run's snapshot doesn't know about, producing exactly the duplicate this whole stage exists to prevent, race-permitting. No cheap per-instance tag exists on the current Readwise or Hardcover API surfaces to guard against this (the task explicitly said not to invent API fields that don't exist, and neither provider's write endpoints used here - `createSessions`, `createBooks`, `updateBooks`, Hardcover's GraphQL mutations - expose a client-supplied free-text/tag field we already populate that could double as an instance id). The mitigation is operational, not code: the owner's staging-then-live plan must not run staging's sync and live's first connect concurrently against the same account; stop staging's sync (or disconnect it) before connecting live.

### Tests

- `readwise-sessions-reconcile.service.test.ts` (new) - 5 unit tests: no-op once reconciled, no-op with no linked books, links a session within tolerance, does not link one outside tolerance, does not double-link one remote session to two local candidates.
- `readwise-sessions-pull.service.test.ts` - added a test asserting a remote session matching an unlinked local one links instead of inserting.
- `readwise-sessions-push.service.test.ts` - added a test asserting the reconcile pass runs (and is awaited) before the per-book push loop.
- `readwise-highlights-ledger-backfill.service.test.ts` - rewritten/expanded for id+text verification and the content-based fallback (carried over from the prior context window, re-verified green in this stage's run).
- `readwise-books-migration.service.test.ts` - added two tests: an exact-match book links silently with no `updateBooks` call, and a differing book still pushes and still writes the link (overwrite-logging path).
- **Not added in this stage**: the task's stateful in-memory fake-remote instance-A/instance-B integration test per provider, and unit tests for a Hardcover matcher (none was needed, see audit above). Flag for the next agent/PR review - this is the largest deferred item from the task list; see "Deferred / risks" below.

### Addendum: the deferred A/B integration tests (follow-up stage)

The single biggest deferred item above - the stateful in-memory fake-remote instance-A/instance-B
integration test per provider - was built as a follow-up stage on this same branch:

- `server/src/modules/readwise/readwise-reconnect-two-instance.integration.test.ts` (new, 2 tests).
- `server/src/modules/hardcover/hardcover-reconnect-two-instance.integration.test.ts` (new, 2 tests).

Harness choice: a real Postgres-backed two-database harness (one DB per "instance") does not exist
in this repo - `server/test/e2e/app-harness.ts` wires one NestJS app onto one already-migrated
database, not two independent instances sharing nothing but a fake external account. Building that
is out of scope for a change confined to `server/src/modules/readwise` and
`server/src/modules/hardcover`. Per the task's documented fallback, both files construct the real
service classes directly (the same pattern every other `*.test.ts` file in these modules already
uses) against hand-rolled but fully stateful in-memory fakes: one call-counted fake remote shared by
both instances, and one fake local-DB layer scoped by `userId` (so "instance A" and "instance B" are
two different `userId`s acting on the same book/session/highlight/user_book rows a snapshot restore
would otherwise duplicate across two physical databases). This does not exercise real Drizzle/SQL -
repository query correctness remains covered by each repository's own unit tests.

Scenarios covered (each provider): instance A syncs first from a snapshot, Readwise/Hardcover-side
changes are then made independently of BookOrbit (a rating edit, a session logged in the Readwise
app), then instance B (same snapshot's book plus its own local rating/status/session/highlight
changes, empty ledger) connects and runs two full cycles; a third test is a never-synced instance's
first migration. All of the task's duplicate/precedence/idempotency assertions pass:
- no duplicate remote book/session/highlight/user_book/read for the shared natural key (checked by
  count per ISBN / per Hardcover `book_id`);
- instance B's local values win on the remote (rating, status) over both A's earlier push and the
  simulated app-side edit;
- A's remote-side session addition imports into B exactly once (reconciled-into-link or pulled-as-new,
  never both);
- pulled Readwise sessions carry no progress/position fields (`endProgress`/`progressDelta` are
  `null` on the inserted row);
- the second cycle for instance B makes zero additional mutating remote calls for both providers.

**No bug was found or fixed in either module.** Both integration tests passed on the first run
against the already-existing `readwise-sessions-reconcile.service.ts`,
`readwise-books-migration.service.ts` and `hardcover-sync.service.ts` logic - this is a positive
result that *confirms* the reconnect-safety behaviour already documented above (the ISBN-first-match
book lookup, the sessions reconcile-before-push pass, and Hardcover's `book_id`-keyed
insert-or-find) actually holds end-to-end across two instances, not just in each service's own unit
tests. No code change to `server/src/modules/readwise` or `server/src/modules/hardcover` was
required for this stage.

Verified on Unraid for this addendum:
- `pnpm run typecheck:server` - clean, exit 0.
- Focused `pnpm vitest run src/modules/readwise src/modules/hardcover`: **45 test files, 622 tests,
  all passed** (includes both new integration test files, 4 tests total).
- Changed-file `npx prettier --check` and `eslint` on both new test files: clean, 0 problems (one
  `eslint --fix` round trip for formatting, then manual fixes for `@typescript-eslint/require-await`
  via a file-level disable comment - the fakes deliberately implement real async interfaces
  synchronously - and for a handful of unused constructor/method parameters).
- BOOT GATE: `pnpm --filter server run build` then, against a disposable
  `pgvector/pgvector:pg18` container on `127.0.0.1:55458` (migrated with `pnpm db:migrate`, removed
  afterwards), `timeout 90 node dist/main.js` logged `"Nest application successfully started"`
  exactly once and `grep -c '"level":50'` was `0`.

Remaining risk (carried forward, unchanged by this addendum): the "two concurrent instances must
never sync the same account at the same time" risk documented above is still a process control, not
a code control - this addendum's tests run A and B sequentially, as the task described, and cannot
exercise or rule out a true concurrent-write race.

### Deferred / risks for the owner's staging-then-live plan

1. ~~**No stateful in-memory fake-remote integration test was written.**~~ Resolved by the addendum
   above - both providers now have a two-instance integration test, no bug found.
2. **The "reconciling" phase is not exposed in sync-run status** (see above) - functional behaviour is in place for sessions, but the owner/UI has no visibility into it beyond logs until the sibling branch's sync-run status work lands and this is wired in.
3. **Books migration's reconcile-before-create was already in place pre-stage** (full-library index phase) but review/rating/date overwrite-logging is new and unverified against a real reconnect scenario - only unit-tested with fakes.
4. **Concurrent-instance race is a process control, not a code control** (see above) - there is nothing stopping the owner from running staging and live sync at the same time today beyond this document.
5. **Highlights pull-side dedupe against a local-origin twin was not changed** because BookOrbit has no local-origin highlights independent of Readwise in the current codebase; if that ever changes (e.g. BookOrbit grows its own annotation-creation feature that also syncs to Readwise), this will need the same local-match-before-insert treatment given to sessions.
6. **Hardcover has no reconcile-pass equivalent to the Readwise sessions one** because its upsert is already id-keyed and idempotent by design; if Hardcover's API ever adds a feature (e.g. reading-journal entries that are not upserted by a stable id) this assumption should be re-checked.

---

## Release: feat-reading-services-release (2026-11-08)

Combines every reading-services stage into one release branch and closes the
"reconciling" gap item 2 noted above. Branch `feat-reading-services-release`,
created from `feat-reading-services-provider-parity` @ `b701cd5ac`, merging
`feat-reading-services-reconnect-safe` @ `1e7b70f8d`. Head commit
**`b250ac3348`**, local only, not pushed. Worktrees: PC
`D:/Development/bookorbit-worktrees/feat-reading-services-release`, Unraid
`/mnt/user/data/Development/bookorbit-worktrees/feat-reading-services-release`.

### Ancestry check (before building)

Verified with `git merge-base --is-ancestor` that
`feat-reading-services-library-scope` @ `3ff34e2d8` (the common base of both
branches merged here) already contains `feat-reading-services-integration`
(`4634f1fe`), `feat-reading-services-widgets` (`3d5ad622`),
`feat-hardcover-social` (`546bd1111`), `merge-upstream-2026-11-08` (`43e1dc8a`)
and `origin/development` (`d4e085e1`) - all four were ancestors, no extra
merge needed.

`feat-reader-backup-import` (the branch live's earlier image was built from)
was **not** a literal git ancestor of `library-scope` (24 commits showed up
under `git log feat-reader-backup-import ^library-scope`), which initially
looked like lost work. Checked further: `git diff d4e085e1a ff35710fc`
(origin/development's HEAD vs feat-reader-backup-import's tip) is **empty** -
the two branches point at identical trees, just reached by different commit
SHAs (origin/development's history squashed/re-committed the same changes
under new hashes). Nothing is actually missing; proceeded with the merge.

### Merge: provider-parity + reconnect-safe

`git merge --no-ff feat-reading-services-reconnect-safe` onto the new branch
produced one real conflict, `docs/AGENT_HANDOFF.md` (both branches appended a
new section at the same point) - resolved by keeping both sections in stage
order (provider-parity's section, then reconnect-safe's). One file,
`server/src/modules/readwise/readwise-books-migration.service.ts`, had
changes from both branches but merged automatically with no conflict markers
(reconnect-safe's PATCH-skip-on-exact-match logic and provider-parity's
unrelated capability fix touched different regions). Merge commit
`743819a6e`.

### New work: the "reconciling" phase

Added on top of the merge (commit `ec970d5e5`, formatting fixup
`b250ac3348`), closing deferred item 2 from the reconnect-safe stage above:

- `packages/types/src/reading-services.ts`: `SyncRunProgress` and
  `ReadingServiceSummary['migration']` both gain an optional
  `phase?: 'reconciling' | null`.
- `reading-service-sync-run.service.ts`: `phase` is derived two ways, no new
  DB column or migration needed. (1) Automatically, from the existing
  Readwise books-migration cursor convention (`cursor.phase === 'index'`
  means the full-library matching pass is still running) - this is the
  "books migration matching" half of the card, handled without touching
  `readwise-books-migration.service.ts` since the convention already
  existed. (2) Via new `markReconciling(userId, provider)` /
  `clearReconciling(userId, provider)` methods backed by an in-memory
  `Set<string>` keyed `${userId}:${provider}` (same lifetime/pattern as the
  existing `cancelled` run-id set) - for passes that run outside a tracked
  migration run, like Readwise's sessions reconcile.
- `readwise-sessions-reconcile.service.ts`: `ensureReconciled` now calls
  `markReconciling` before the pass and `clearReconciling` in a `finally`
  block, so the phase clears on success or failure.
- `ReadingServiceMigrationPanel.vue` (client): shows a distinct
  `reconcilingDescription` sentence instead of the generic running
  description while `run.phase === 'reconciling'`; new `en.json` key.
- Tests: new unit tests in `reading-service-sync-run.service.test.ts` (both
  derivation paths) and `readwise-sessions-reconcile.service.test.ts` (marks
  and always clears, including on throw), plus a new
  `ReadingServiceMigrationPanel.spec.ts` case for the client message swap.

### Migrations

0139-0144 (the reading-services stack's own migrations) are unique and
sequential; confirmed via the journal's own `idx` field
(`server/src/db/migrations/meta/_journal.json`), which is what Drizzle
actually orders by. Note: the filenames 0101-0103 are reused by two
different migrations each (an unrelated pre-existing quirk from the upstream
merge history, journal `idx` 101-103 and 132-134) - the journal's 145 `idx`
values are 0..144 with no gaps and no duplicate tags, so this does not affect
migration correctness.

Verified on Unraid against a fresh `pgvector/pgvector:pg18` disposable
container (`bookorbit-release-db`, `127.0.0.1:55460`, dropped after use):
`pnpm db:migrate` applied all 145 migrations cleanly, then
`pnpm db:generate drift_check` reported "No schema changes, nothing to
migrate". Also restored the live pre-merge backup
(`/mnt/user/appdata/bookorbit-backups/bookorbit-pre-upstream-merge-20261108-015217.dump`)
into a second disposable container (`bookorbit-restore-test-db`,
`127.0.0.1:55461`, never `bookorbit-db`) via `pg_restore --no-owner --no-acl`,
then `pnpm db:migrate` applied cleanly against that real-data copy too.
Container dropped after.

### Gates (all on Unraid, 192.168.5.3)

- Server + client `pnpm run typecheck:server` / `typecheck:client`: exit 0
  both.
- Server vitest `src/modules/readwise src/modules/hardcover
  src/modules/reading-services`: **60 files, 766 tests, all passed**.
- Client vitest `src/features/reading-services src/features/readwise
  src/features/hardcover src/features/settings src/features/dashboard`:
  **116 files, 1380 tests, all passed**.
- `node ./scripts/validate-locales.mjs`: "Validated 25 locale catalogs
  against 12253 English messages".
- Changed-file (vs `feat-reading-services-provider-parity`, the release
  branch's own new work - the 731-file diff against `origin/development`
  is the whole reading-services stack validated by earlier stages, not new
  work from this one) `eslint`/`prettier`: one real finding (a long
  constructor call in the two-instance integration test and one ternary
  line in `ReadingServiceMigrationPanel.vue`), both fixed with
  `eslint --fix` / `prettier --write`, then clean.
- BOOT GATE, both green, zero `"level":50` lines, both logged `Nest
  application successfully started` exactly once:
  - (a) no `READING_SERVICES_PRIVATE_ADAPTERS_DIR` set.
  - (b) `READING_SERVICES_PRIVATE_ADAPTERS_DIR` pointing at a tracked-files-only
    copy (`git archive`, no `private/` folder - there wasn't one) of the real
    adapter at `C:/Users/grib/Development/readwise-accessibility-poc/bookorbit-adapter`
    (git HEAD `87a63f5`), copied to
    `/mnt/user/data/Development/bookorbit-private-adapters-test/readwise-social`
    on Unraid. Logged `provider=readwise-social - adapter registered` and
    `loaded=1 scanned=1`.
  - Registered a test user via `POST /auth/setup` (`x-setup-token` header)
    in the disposable DB, then `GET /api/v1/reading-services` with that
    user's token: the `readwise-social` summary's `authMethods` lists all
    three kinds - `password`, `token`, `device_code` - confirming the
    private adapter's parity surface is reachable end to end, not just
    loaded at boot.

### Docker image

Built from the Unraid release worktree:
`docker build -t andrewgribben/bookorbit:release-b250ac334 .` -
succeeded, image id `58fcebb5d841`, 945MB. `docker system df` showed 18.59GB
reclaimable before the build (no prune needed). **Not tagged `:development`,
not run against any real database.**

### Env vars / mounts the live container needs for a private adapter

- `READING_SERVICES_PRIVATE_ADAPTERS_DIR` - absolute path inside the
  container to a directory containing the adapter's `index.mjs` (or
  `index.js`) and its `lib/` etc. directly at that path (not a parent
  directory of multiple adapters - the loader only scans the given directory
  itself for an entrypoint file, see
  `reading-service-private-adapter-loader.service.ts`).
- `READING_SERVICES_ENCRYPTION_KEY` - already required for the stored
  private-credential table from the provider-parity stage; unchanged here.
- Suggested mount for the live container: read-only bind mount
  `/mnt/user/appdata/bookorbit-private-adapters -> /app/private-adapters`
  (host directory holding one subfolder per adapter, operator picks which
  one `READING_SERVICES_PRIVATE_ADAPTERS_DIR` points at, e.g.
  `/app/private-adapters/readwise-social`), `:ro` since the loader only
  reads it at boot.

### Not done / flagged for the owner

- The image was **not** pushed to any registry and the container was
  **not** deployed - per the card, this stays local-build-only until the
  owner approves a deployment.
- `feat-reading-services-release` was **not** pushed to the fork remote;
  it exists only in the two local worktrees above.

---

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
