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

## Latest state (2026-11-05)

Read this section first; the older sections below describe the v3.6.0 merge.

Live site runs image `andrewgribben/bookorbit:development-190b664f`, built from branch `feat-reader-backup-import` (not `development`). Rollback images: `andrewgribben/bookorbit:rollback-pre-progress-rules`, `...:rollback-pre-reader-backup-source`, `...:rollback-pre-reader-backup-hint`, `...:rollback-pre-reader-import`, `...:rollback-pre-book-actions`.

Mihon and Komikku backups are a Source Type in the library import (Settings -> Maintenance); picking it shows upload, preview and apply in place of the server wizard. It is no longer on the Komga API page. Smart scope Reading progress rules now respect explicit Read/Unread statuses and count audiobook progress. Tachimanga `.tmb` backups (SQLite) are not supported yet; the user may send a sample. Pre-deploy DB dumps are in `/mnt/user/appdata/bookorbit-backups/`.

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
