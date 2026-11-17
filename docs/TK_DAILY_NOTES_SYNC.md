# TK daily notes sync: spec and agent brief

Status: proposed, not built. Owner decisions answered (see end); ready to dispatch.

## Goal

One-way, append-only push from BookOrbit to TK (tk.xyz, Medium's writing app):

1. **Reading notes.** Each new annotation (highlight and/or note) and each new book journal entry is appended to the TK Daily Note for the local day it was made.
2. **Finished books.** When a book's status becomes `read`, an entry is appended to the TK Daily Note for the local day it was finished.

TK is never read back into BookOrbit. Edits and deletes in BookOrbit after a sync are not propagated.

## Verified TK facts (from the obsidian-tk-sync spike, 2026-11-17)

Reference client: `/Users/grib/orca/workspaces/2tk/gurnard/spike/tk.py` (about 150 lines, OAuth + JSON-RPC). Tool schemas: `.../gurnard/spike/tools.json`.

- MCP endpoint `https://tk.xyz/mcp`, Streamable HTTP, JSON-RPC 2.0. Send `Accept: application/json, text/event-stream`, `MCP-Protocol-Version: 2025-06-18`, and echo the `Mcp-Session-Id` response header. Responses are JSON or SSE (`data:` lines; take the message with an `id`). Do `initialize` then the `notifications/initialized` notification before `tools/call`.
- **Cloudflare blocks the default Node/undici User-Agent (error 1010).** Always send `User-Agent: bookorbit-tk-sync/<version>`.
- Tool results: `result.content[0].text` is a JSON string. Parse it.
- OAuth 2.1 + PKCE (S256), dynamic client registration at `POST /oauth/register` (public client, `token_endpoint_auth_method: none`), authorise at `/oauth/authorize`, token at `/oauth/token` (form-encoded), `scope=read write`, `resource=https://tk.xyz/mcp` on both authorise and token calls. Refresh with `grant_type=refresh_token`; keep the old refresh token if none is returned. On 401, refresh once and retry.
- **Redirect URIs must be loopback: `http://127.0.0.1:<port>/callback`.** BookOrbit is a remote server, so the redirect cannot reach it. See "Connect flow".
- Daily notes are exposed:
  - `get_daily_note {date: "YYYY-MM-DD", format: "json"}` returns `found: false` when the day has no note (does not create one), otherwise the note id and Tiptap JSON with node `attrs.id`.
  - `create_daily_note {date, content, tags?, skip_writing_prompt?}`: builds the note from the user's template and appends `content` (Markdown, no title heading). **Fails if the day already has a note**; the error carries the note id. Not idempotent. `content` must be non-empty.
  - `edit_document {document_id, ops}`: merge-safe. Use `insert_sibling_node` with `anchor_node_id` + `position: "after"` and Markdown `content`. Errors on shared docs unless `confirm_shared: true`; **never set it** (treat as a skip with a logged reason).
  - `date` is the user's LOCAL date. The server has no timezone, and a note written to the wrong day cannot be undone.
- Every text node may carry an `author` mark (AI attribution); ignore it. Notes created via the API are flagged `created_by_ai` (accepted by the owner).
- No delete tool exists. Never call `update_document` (whole-body replace) on a daily note.

## Design: copy the Readwise module

`server/src/modules/readwise/` is the template: settings table + settings service, event listener on `AchievementEventsService`, debounced auto-sync scheduler, queue, client, sync service, controller, client settings page (`client/src/features/readwise/`). Mirror its shape as `server/src/modules/tk/` and `client/src/features/tk/`. Do not invent a new architecture.

### Data

Migration adds two tables.

`tk_user_settings` (one row per user, like `readwise_user_settings`):
- `user_id` unique FK cascade, `enabled` bool, `disabled_reason` text, `last_synced_at`.
- `client_id`, `access_token_enc`, `refresh_token_enc`, `expires_at`. Tokens encrypted with `encryptAesGcm` from `server/src/common/secrets/aes-gcm-secret.ts`, key from config `bookRequest.encryptionKey` (same as `metadata-http-provider-secrets.service.ts`). If no key is configured, refuse to connect with a clear error. Never log tokens.
- `pending_oauth` jsonb: `{client_id, code_verifier, state, redirect_uri, created_at}` for an in-flight connect; cleared on success, expires after 10 minutes.
- Watermarks `last_annotation_id`, `last_journal_created_at`, `last_finished_at`, plus `connected_at` and `backfill_requested_at`. See "Backfill".

`tk_sync_items` (ledger, prevents duplicates):
- `user_id`, `kind` (`annotation` | `journal` | `finished`), `source_key` (annotation id, journal client id, or `bookId:finishedAt-ISO`), `date_key` (YYYY-MM-DD), `tk_document_id`, `synced_at`.
- Unique `(user_id, kind, source_key)`.

### Triggers

- `ACHIEVEMENT_EVENT_ANNOTATION_CREATED` -> `scheduler.requestSync(userId)` (as Readwise).
- `ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED` where `newStatus === 'read'` -> `requestSync(userId)`.
- Journal entries emit no event today. Either emit a new event from `BookJournalService.create` or have the scheduler also run hourly. Prefer the event (smallest, immediate).
- Flush reads from the DB using the watermarks/ledger, so events are only wake-up signals. Reuse Readwise's debounce/retry constants pattern.

### Flush (per user)

1. Load settings; stop if not enabled, no permission, or no tokens.
2. Collect pending items since watermarks, skipping any already in `tk_sync_items`:
   - annotations: `deleted_at is null`, text or note non-empty (reuse `ReadwiseRepository.findNewHighlights` query shape, including authors join).
   - journal entries: active, not trashed.
   - finished: `user_book_status.status = 'read'` and `finished_at` set, after `last_finished_at`.
3. Compute each item's `date_key` with `toDateKeyInTimeZone(createdAt | finishedAt, resolveTimeZone(user.settings.timezone))` from `server/src/common/utils/timezone.utils.ts`.
4. Group by `date_key`, oldest day first. For each day, render one Markdown block (pure function, see "Rendering") and write it:
   - `get_daily_note(date, json)`.
   - If `found: false`: `create_daily_note(date, content=block, tags=["bookorbit"])`. If it fails with "already exists" (race), fall through to the edit path using the returned id.
   - If found: drop any item whose BookOrbit link URL already appears in the note JSON (link mark `href`). This makes a crash between the TK write and the ledger insert safe to retry. Then `edit_document` with one `insert_sibling_node` op, `position: "after"`, anchored on the last node of the existing `BookOrbit` section if present, otherwise the last top-level node of the note.
   - On success insert ledger rows and advance watermarks in one DB transaction.
5. Errors: 401 after one refresh -> set `enabled=false, disabled_reason='invalid_token'` (as Readwise). Shared-doc error -> skip that day, ledger nothing, set `disabled_reason='daily_note_shared'`, surface in settings. Other errors -> throw so the scheduler retries with backoff. Log with the existing `[tk.sync] [start|end|fail]` style and `sanitizeLogValue`.
6. Serialise TK calls per user (one at a time). TK publishes no rate limit; add a 300 ms minimum interval like Readwise.

### Rendering (pure, unit-tested)

Section heading `## BookOrbit` (created once per day, only in the first block written to that day). Items under it, in time order:

- Annotation: `> highlight text` then, if a note, `- Note: ...`, then `[Title, Author](APP_URL/book/<id>?tab=highlights&annotationId=<id>)`. Reuse `bookOrbitReadwiseHighlightUrl` (move it to a shared util rather than copy).
- Journal entry: body as a paragraph, quote as `>` if present, then the book link.
- Finished: `Finished [Title](APP_URL/book/<id>) by Author.` plus `Rating: N/5` if rated.

Escape Markdown in user text that would change structure (leading `#`, `>`, `-`). Truncate any single item at 8,000 characters.

### Connect flow (the loopback problem)

TK only accepts `http://127.0.0.1:<port>/callback`. The server cannot receive it, so use paste-back:

1. Settings page "Connect TK" -> `POST /api/v1/tk/connect/start`. Server registers a client (or reuses `client_id`), creates PKCE verifier + state, stores `pending_oauth`, returns the authorise URL with `redirect_uri=http://127.0.0.1:53682/callback`.
2. Client opens it in a new tab. After sign-in the browser lands on `127.0.0.1:53682/callback?code=...&state=...`, which shows a connection error page. That is expected.
3. User copies that address-bar URL into a field and submits -> `POST /api/v1/tk/connect/finish {callbackUrl}`. Server checks `state`, exchanges the code with the stored verifier, stores encrypted tokens, seeds watermarks, clears `pending_oauth`.
4. UI copy must explain step 2 plainly. Codes are short-lived: show the paste field immediately.

Verify before building: register a client with port 53682 from a non-loopback machine and confirm TK accepts the redirect. If TK rejects arbitrary ports or dynamic registration from servers, stop and report.

Disconnect: delete tokens and `pending_oauth`, keep the ledger (so reconnecting does not duplicate).

### API and permissions

- Add `Permission.TkSync = "tk_sync"` alongside `ReadwiseSync` in `packages/types/src/permissions.ts`; gate exactly as `userHasReadwiseSyncPermission` does (superuser or permission).
- Endpoints under the existing auth guard: `GET/PUT /tk/settings` (`enabled`), `POST /tk/connect/start`, `POST /tk/connect/finish`, `POST /tk/disconnect`, `POST /tk/sync` (manual flush). Types in `packages/types/src/tk.ts`. Locale strings in `en.json` only.

## Agent brief (paste to the dev worker)

Read `AGENTS.md`, `docs/AGENT_HANDOFF.md` from the newest branch, and this file. Follow the BookOrbit workflow: edit on the Mac in worktree `/Volumes/External/Development/Personal/bookorbit-worktrees/feat-tk-daily-notes` (branch `feat/tk-daily-notes` off `origin/development`); run every install, test, lint, typecheck and migration on Unraid in the matching worktree. Never run pnpm/vitest/tsc on the Mac. Never point tests at `bookorbit-db`; e2e uses the throwaway Postgres recipe. Do not push, deploy or run migrations against live data.

Build, in this order, committing each stage:
1. Pure pieces with unit tests: TK MCP client (inject `fetch`; SSE + JSON parsing; 401 refresh-once; User-Agent), Markdown renderer, day grouping/date keys across a timezone boundary, "already in note" link detection over Tiptap JSON, anchor selection (existing `## BookOrbit` section vs last node).
2. Migration + repository + ledger, with repository tests.
3. Connect flow (start/finish/disconnect) with state mismatch, expired pending, and missing encryption key tests.
4. Event listener, scheduler, flush; tests for: create-then-edit race, crash-after-write retry produces no duplicate, shared-doc skip, invalid token disables, `status` changes other than `read` ignored, re-finishing a book (new `finished_at`) adds a new entry.
5. Settings UI copying `ReadwiseSettings.vue`, with the paste-back step and the backfill preview + button.
6. Backfill: preview counts match a seeded fixture; items before `connected_at` are not sent until backfill is requested; an interrupted backfill resumes without duplicates.

Live TK calls during development: read-only (`get_daily_note`) only, unless the owner names a test date to write to. Acceptance: all client and server checks green on Unraid; report commands and outcomes, not summaries.

## Backfill

On connect, watermarks start at zero (not the latest ids), but nothing is sent automatically. The settings page shows "Backfill: N items across M days, oldest YYYY-MM-DD" (a dry-run count from `POST /tk/backfill/preview`) and a "Send history to TK" button (`POST /tk/backfill`). Until the owner presses it, auto-sync sends only items newer than the moment of connecting. Backfill uses the same flush path, oldest day first, so the ledger and link check make it safe to stop and resume. It creates past Daily Notes where missing and cannot be undone, which is why it needs the explicit button press.

## Owner decisions (answered 2026-11-17)

1. **Notes scope:** annotations (highlights and notes) plus book journal entries.
2. **Finished book:** an entry in that day's Daily Note. `skimmed` does not count.
3. **Backfill:** yes, full history, behind the preview + button above.
4. **Dates:** always the local day the note was made (or the book was finished), including old-dated KOReader/Kobo imports.
5. **Encryption key:** `BOOK_REQUEST_ENCRYPTION_KEY` (config `bookRequest.encryptionKey`) is already set on the live container. No action needed.
