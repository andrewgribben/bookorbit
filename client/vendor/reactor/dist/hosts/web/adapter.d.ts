import { ContentCore } from '../../core/content-core.js';
import { type HostChannel } from '../../host-api/index.js';
import type { ReaderCommand } from '../../protocol/v1/commands.js';
import type { ReaderEvent } from '../../protocol/v1/events.js';
import type { ReaderOpenMeta } from '../../protocol/v1/meta.js';
export interface WebHostOptions {
    /** Creates a protocol v2 `HostChannel` alongside `core` (SPEC.md D3). Omitted (the default)
     * means `chrome: "host"`-only: no v2 traffic, matching W1's section-4 decision for the first
     * landing. A host can still opt in later by constructing its own `createHostChannel()`. */
    v2?: boolean;
}
export interface WebHost {
    /** The underlying engine. Exposed directly (not re-wrapped) so a host that needs a method this
     * adapter does not forward (e.g. `getOpenBook`, `createSecondaryView`) is never blocked. */
    readonly core: ContentCore;
    /** The v2 host channel, present only when `options.v2` was set. */
    readonly hostChannel: HostChannel | undefined;
    /** Subscribes to every emitted v1 `ReaderEvent` object (typed, not a JSON string). Returns an
     * unsubscribe function. */
    on(listener: (event: ReaderEvent) => void): () => void;
    /** Dispatches a typed `ReaderCommand`, equivalent to Android's `__readerCommand` but with no
     * JSON round trip. */
    dispatch(command: ReaderCommand): void;
    /** Begins a streamed open (equivalent to `__readerBegin`). */
    beginOpen(meta: ReaderOpenMeta): void;
    /** One chunk of the file started by `beginOpen` (equivalent to `__readerChunk`, but taking
     * already-decoded bytes - no base64). */
    pushChunk(bytes: Uint8Array): void;
    /** Finishes the transfer started by `beginOpen`/`pushChunk` and opens it (equivalent to
     * `__readerCommit`). */
    commitOpen(): Promise<void>;
    /** Lazily opens a remote EPUB over HTTP Range-style per-entry fetches (R-G5). `fetcher`
     * defaults to the global `fetch`; pass one that adds headers (e.g. `Authorization`) for a
     * host that requires auth on every request, mirroring the web client's existing `fetchFile`
     * pattern. */
    openLocal(meta: ReaderOpenMeta, baseUrl: string, fetcher?: typeof fetch): Promise<void>;
    /** Lazily opens a plain remote EPUB over HTTP Range (BO-41): unlike `openLocal`, `url` is the
     * EPUB file's own URL - there is no server-side entries manifest. Reads the zip's central
     * directory and entries straight out of the remote file via Range requests, falling back to
     * one whole-file fetch only when the server does not answer Range with 206. `fetcher` behaves
     * like `openLocal`'s (defaults to the global `fetch`, pass one that adds an `Authorization`
     * header for a host that requires auth). `size`, if already known, skips a one-time size
     * probe request. */
    openRemote(meta: ReaderOpenMeta, url: string, fetcher?: typeof fetch, size?: number): Promise<void>;
    /** R-G7: sets (or clears, with `null`) extra CSS injected into every rendered section
     * alongside `applyStyles`'s generated CSS - e.g. custom @font-face rules for a user-uploaded
     * font. Additive: a host that never calls this is unaffected. */
    setExtraCss(css: string | null): void;
    /** Tears down the mounted view and drops all listeners. Safe to call once; the container
     * passed to `createWebHost` is left empty afterwards. */
    destroy(): void;
}
/** Creates a typed, in-page Reactor host bound to `container`. No globals, no postMessage, no
 * iframe (W1 section 4/9: direct in-page mounting). */
export declare function createWebHost(container: HTMLElement, options?: WebHostOptions): WebHost;
