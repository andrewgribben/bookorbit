# Handover: Reading services (Readwise, Hardcover, Readwise friends) and Android

Last updated 2026-11-08. Read this first, then `AGENTS.md`, `CLAUDE.md`, and the detailed per-stage log in
`docs/AGENT_HANDOFF.md` (sections from "S1" onward). This file is the summary; that one has the evidence.

## 1. Rules you must follow

- **Where things run.** The owner's PC (`D:/Development/bookorbit`, worktrees in
  `D:/Development/bookorbit-worktrees/<branch>`) only edits code and makes local commits. All installs,
  tests, lint, typecheck, migrations, Docker builds, git pushes and deploys run on Unraid over SSH
  (`root@192.168.5.3`, repo `/mnt/user/data/Development/bookorbit`, worktrees
  `/mnt/user/data/Development/bookorbit-worktrees/<branch>`). Move commits PC -> Unraid with `git bundle`
  and `git merge --ff-only FETCH_HEAD`.
- **Git.** Push only to `origin` (`andrewgribben/bookorbit`), only from Unraid, hooks on
  (`NODE_OPTIONS=--max-old-space-size=8192 git push origin <branch>`). Never push to upstream
  `bookorbit/bookorbit` and never open PRs or issues there (the upstream owner rejects AI-written code).
  Never rebase or force-push published branches. Conventional commits, no `Co-authored-by`, no em dashes.
- **Live data.** `bookorbit-db` is the owner's real library. Read-only queries are fine. Any write,
  migration or bulk job needs the owner's go-ahead and a fresh dump first.
- **Deploys.** The owner calls the `bookorbit` container at https://library.grib.co "staging" and has
  given standing permission to deploy to it, provided a fresh DB dump is taken and the current image is
  tagged for rollback before EVERY deploy. Report backup file, rollback tag, health and error count each
  time. Ask before any template/env/mount change or anything destructive to data.
- **Never** `pkill`/`killall`/`kill` by process name on Unraid. The host sees container processes; this
  once took the live site down for 2.5 hours. Run boot gates under `timeout` and kill only your own PID.
- **UI work** goes through the `design-taste-frontend` skill (desktop, tablet and phone screenshots).
- Owner preferences: short, plain answers; no podcasts (removed); unsupported provider features are
  hidden, not shown as unavailable.

## 2. Fast loop (about 5 minutes from commit to live)

Two scripts live on Unraid in `/mnt/user/appdata/bookorbit-backups/`:

```bash
# PC: commit, then bundle and copy to Unraid
git -C D:/Development/bookorbit-worktrees/<branch> bundle create <scratch>/x.bundle <old>..<branch>
scp <scratch>/x.bundle root@192.168.5.3:/tmp/x.bundle

# Unraid: ff-merge the bundle, then image build + typechecks + focused vitest in parallel
bash /mnt/user/appdata/bookorbit-backups/build-check.sh \
  /mnt/user/data/Development/bookorbit-worktrees/<branch> /tmp/x.bundle <branch> \
  "src/modules/readwise src/modules/reading-services" "src/features/dashboard src/features/reading-services"

# Unraid: DB dump, rollback tag, retag :development, rebuild container, health + log check
bash /mnt/user/appdata/bookorbit-backups/deploy-tag.sh <short-sha>
```

The image builds in 1-2 minutes (deps are cached). Run the PC side as a foreground command; background
shells on the PC lost `PATH`. Rollback: `docker tag andrewgribben/bookorbit:rollback-pre-<sha>
andrewgribben/bookorbit:development` then
`/usr/local/emhttp/plugins/dynamix.docker.manager/scripts/rebuild_container bookorbit`.

## 3. What is live now

- Branch **`feat-reading-services-release`**, commit `05d083aec` (plus this handover doc), image
  `andrewgribben/bookorbit:release-05d083aec`, tagged `:development`, running in `bookorbit`.
- Last backup: `/mnt/user/appdata/bookorbit-backups/bookorbit-pre-05d083aec-20261108-173548.dump`.
  Rollback tag: `rollback-pre-05d083aec`. Earlier rollback tags: `rollback-pre-69deb40fa`,
  `rollback-pre-ce995bc55`, `rollback-pre-signin-fix`, `rollback-pre-reading-services`.
- Database is at 145 migrations (reading-services adds 0139-0144; 0138 dropped podcasts).
- Private Readwise friends adapter mounted read-only from `/mnt/user/appdata/bookorbit-private-adapters`
  (`READING_SERVICES_PRIVATE_ADAPTERS_DIR`); credentials encrypted with `READING_SERVICES_ENCRYPTION_KEY`.
- Separate test copy `bookorbit-staging` (port 3031, sanitized DB copy, outbound integrations disabled)
  exists for visual checks. Don't connect real Readwise/Hardcover accounts there: two instances syncing
  one account at the same time is not prevented in code.

## 4. What the release contains

Branch history (all merged into `feat-reading-services-release`, local branches kept for reference):

| Area                | Branch                                                         | Notes                                                          |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Upstream merge      | `merge-upstream-2026-11-08`                                    | upstream v3.x into the fork; podcasts dropped (0138)           |
| Provider framework  | `feat-reading-services-core`                                   | adapter registry, sync runs, cancel/resume, 0140 run guard     |
| Readwise books      | `feat-readwise-books-migration`, `feat-readwise-books-two-way` | one-time push, then two-way status/rating/dates                |
| Readwise sessions   | `feat-readwise-sessions`                                       | migration 0141                                                 |
| Reviews             | `feat-book-review`                                             | migration 0142                                                 |
| Readwise highlights | `feat-readwise-highlights-two-way`                             | first connect pushes existing highlights                       |
| Settings UI         | `feat-readwise-web-settings`                                   |                                                                |
| Dashboard           | `feat-reading-services-widgets`                                | reading recap, Owned elsewhere shelf                           |
| Hardcover social    | `feat-hardcover-social`                                        | friends shelves                                                |
| Library scope       | `feat-reading-services-library-scope`                          | per-library, per-feature (0143)                                |
| Provider parity     | `feat-reading-services-provider-parity`                        | private adapters, encrypted creds (0144), sign-in UI           |
| Reconnect safety    | `feat-reading-services-reconnect-safe`                         | two-instance tests, no duplicates on reconnect                 |
| Taste fixes         | `fix-reading-services-taste`                                   | shelf names, phone overflow (`fieldset min-w-0`), sign-in link |
| Migration 400       | `fix-readwise-migration-400`                                   | batch limits 100 PATCH / 10 POST, per-item retry on 4xx        |
| Book Requests       | `feat-readwise-only-requests`                                  | Request / Request all for Readwise-only books                  |

Fixes made directly on the release branch after that:

- `ce89a007`, `73115afd`: sign-in section crashed when a provider auth method had no `fields`.
- `69deb40fa`: Readwise write endpoints answer `{ results: [...] }` with numeric `book_id`/`session_id`
  (the code read `.items`, so every create looked failed after Readwise had accepted it). Batches are now
  resent item by item only after a 4xx, because Readwise does not dedupe sessions. Each migration run
  starts with an empty remote index (the Readwise-only list showed books twice). Dashboard config keeps
  runtime provider ids like `readwise-social` (friends shelves were dropped on save).
- `05d083aec`: Readwise counted as "connected" from the saved token, not the highlights-sync toggle (the
  Owned elsewhere shelf said "Sign in" for a connected user).

## 5. Product decisions (owner-approved)

- First Readwise migration: BookOrbit is the source of truth. After that, sync both ways. BookOrbit wins
  book/review conflicts. Readwise-origin reading sessions never move the BookOrbit reading position.
  Highlights: latest write wins.
- Books with no status in BookOrbit are **not** pushed to Readwise (the API cannot add to Readwise's
  "unsorted" shelf; the owner chose not to dump them into Want to read).
- Readwise-only books are not created as BookOrbit books (books need files); they appear in the
  Readwise-only list and Owned elsewhere shelf, with Request / Request all into Book Requests (pending,
  no automatic download unless the owner's request automation approves it).
- Library overrides can only narrow provider-level features, never widen them.
- Hardcover's owned-books write API is undocumented: don't invent mutations.

## 6. What to check next

1. The owner is re-running the Readwise migration now. Expected: the 75 books from the failed run count
   as Updated (Readwise matches them), Failed is 0, Readwise-only list has no duplicates. If Failed is not
   0, read `docker logs bookorbit | grep books_migration` for `[fail]` lines: they now carry the HTTP
   status and response body.
2. Check the owner's Readwise library for duplicate books without an ISBN from the failed run (Readwise
   dedupes by ISBN/ASIN/title+author, so there should be none).
3. Owner to confirm the Customize Dashboard external shelves now save, and Owned elsewhere no longer says
   "Sign in".
4. Known follow-ups, not started:
   - An empty-string review may be rejected by Readwise (accepts 1-10000 chars or `null`). Coerce `''`
     to `null` if it shows up in `[fail]` logs.
   - 15 older taste-lint findings in `DashboardSettingsSheet.vue` (borders, shadows, transitions) that
     predate this work.
   - 5 pre-existing failures in `DashboardSettingsSheet.spec.ts` were fixed on the taste branch; the
     wider full server suite has ~210 pre-existing unrelated failures (architecture allowlist, native
     sqlite/embedder, CWA snapshot) - don't chase them as part of this work.
   - Concurrent sync of one account from two BookOrbit instances is not prevented in code.
   - Merge `feat-reading-services-release` into `development` only when the owner says so.
   - The PC's main checkout `D:/Development/bookorbit` (branch `development`) has 516 staged files of
     unknown origin (their tree matches no branch). Nothing was committed from it. Ask the owner before
     unstaging or committing anything there.

## 7. Android app (`andrewgribben/bookorbit-android`)

- PC repo `D:/Development/bookorbit-android`. Branches: `feat-reading-services-parity` (`de80851`, in-app
  provider sign-in and list screens), `feat/auto-speed-button` (`0a736f5`, Android Auto / notification /
  lock-screen playback speed button cycling 0.75x-2x), combined in `device/integration-3` (`64b90a0`).
- `device/integration-3` (542 unit tests passed) is installed on the owner's Galaxy Fold
  (versionCode 701, 0.7.1). The speed button is published on the media session; the owner still needs to
  confirm it shows in the car.
- Earlier design: Global / This book reader settings on all devices, per-book styles stored locally,
  audio controls in a bottom bar with playback settings in a tab.

## 8. Private Readwise friends adapter

- Separate local repo `C:/Users/grib/Development/readwise-accessibility-poc/bookorbit-adapter` (commit
  `87a63f5`, no remote; keep it out of both BookOrbit forks). Contract v2: device-code, pasted session
  token, and password sign-in (exact `/bookwise/api/login/` request from the Readwise app; password never
  stored or logged). Deployed copy: `/mnt/user/appdata/bookorbit-private-adapters/readwise-social`.
- Never print credentials, session tokens, or friends' personal data in logs, chats or docs.

## 9. First commands

```bash
ssh root@192.168.5.3
cd /mnt/user/data/Development/bookorbit-worktrees/feat-reading-services-release
git status -sb && git log -5 --oneline
docker ps --filter name=bookorbit --format '{{.Names}}\t{{.Status}}\t{{.Image}}'
docker logs --since 30m bookorbit 2>&1 | grep -iE 'readwise|"level":50' | tail -30
ls -t /mnt/user/appdata/bookorbit-backups | head
```

Then ask the owner what they want next.
