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
