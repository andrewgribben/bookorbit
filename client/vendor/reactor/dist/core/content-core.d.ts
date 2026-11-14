import '../vendor/foliate/view.js';
import type { ReaderOpenMeta } from '../protocol/v1/meta.js';
import type { ReaderCommand } from '../protocol/v1/commands.js';
import type { ReaderEvent } from '../protocol/v1/events.js';
import type { ReaderSettings } from '../protocol/v1/settings.js';
import type { FoliateBook } from './foliate-types.js';
import { type SecondaryView } from './secondary-view.js';
import { type GlossaryTapRect, type GlossaryTerm } from './glossary.js';
/** MIME types for every format the host app routes to the WebView (SPEC.md D11) plus the comic
 * formats listed in SPEC.md section 4's architecture sketch. Unknown formats fall back to
 * `application/octet-stream`, same as bridge.js. */
export declare const MIME: Record<string, string>;
type Listener = (event: ReaderEvent) => void;
export declare class ContentCore {
    private readonly container;
    private listeners;
    private currentSettings;
    private view;
    private pending;
    private narrationActiveClass;
    private narrationPlaybackActiveClass;
    private narration;
    private restoringPosition;
    private relocateChain;
    private annotations;
    private lastAnnotationHitAt;
    private search;
    private glossaryTerms;
    private glossaryPromise;
    /** Memoizes CFI -> chapter label lookups for the Notes tab (U5 Defect B fix); cleared on
     * every new book so a stale title from a previous book never leaks through. */
    private chapterTitleCache;
    private glossaryTapListeners;
    /** R-G7: extra CSS a host injects alongside `generateCSS`'s output (e.g. a web client's
     * user-uploaded custom @font-face rules). Additive only: null/empty changes nothing, and
     * every existing host that never calls `setExtraCss` sees exactly the CSS it always did. */
    private extraCss;
    constructor(container: HTMLElement);
    /** Subscribes to every emitted v1 event; returns an unsubscribe function. */
    on(listener: Listener): () => void;
    private emit;
    private emitError;
    /** Begins a streamed open (mirrors `__readerBegin`'s payload handling). Byte decoding from the
     * wire (e.g. base64) is a host adapter concern; this takes already-decoded bytes. */
    beginOpen(meta: ReaderOpenMeta): void;
    /** One chunk of the file started by `beginOpen` (mirrors `__readerChunk`). */
    pushChunk(bytes: Uint8Array): void;
    /** Finishes the transfer started by `beginOpen`/`pushChunk`* and opens it (mirrors `__readerCommit`). */
    commitOpen(): Promise<void>;
    private openChunks;
    /** Lazy local-EPUB open: fetches zip entries one at a time from `baseUrl` (mirrors
     * `__readerOpenLocal`). Keeps peak memory proportional to the current section, not the whole
     * book - see src/vendor/foliate/local-zip-loader.js.
     *
     * `fetcher` (R-G5) is an optional caller-supplied replacement for the global `fetch` used to
     * read `baseUrl`'s entries; a host behind auth (e.g. a web client) can pass one that adds an
     * `Authorization` header. Omitting it keeps every existing same-origin caller's behaviour
     * byte-identical - it still ends up calling plain `fetch`, exactly as before this parameter
     * existed. */
    openLocal(meta: ReaderOpenMeta, baseUrl: string, fetcher?: typeof fetch): Promise<void>;
    private finishOpen;
    private createView;
    private attachHandlersForDoc;
    private postHistory;
    applyStyles(settings: Partial<ReaderSettings> | null | undefined): void;
    /** R-G7: sets (or clears, with null/empty) extra CSS injected into every section alongside
     * `generateCSS`'s output - e.g. a web host's user-uploaded custom @font-face rules. Re-applies
     * immediately if a book is open; otherwise takes effect on the next `applyStyles`/open.
     * Additive-only: a host that never calls this sees exactly the CSS it always did. */
    setExtraCss(css: string | null | undefined): void;
    private drawAnnotation;
    private eraseAnnotation;
    setAnnotations(items: Array<{
        cfi: string;
        color: string;
        style: string;
    }> | null | undefined): void;
    clearSelection(): void;
    runSearch(query: string): void;
    clearSearch(): void;
    goTo(target: string): void;
    goToFraction(value: number): void;
    prev(): void;
    next(): void;
    historyBack(): void;
    historyForward(): void;
    setSwipe(enabled: boolean): void;
    narrationPrepare(generation: number): void;
    narrationCancelPrepare(): void;
    narrationHighlight(textHref: string): void;
    narrationUnhighlight(): void;
    /** Dispatches a parsed `ReaderCommand`, mirroring `__readerCommand`'s switch exactly. */
    dispatch(command: ReaderCommand): void;
    emitReady(): void;
    /** The currently open book instance, or null before a book has opened. Exposed only so a
     * second content view (Context mini-reader) can share it rather than opening a second `EPUB`
     * instance - see docs/spikes/S2-two-views.md. */
    getOpenBook(): FoliateBook | null;
    /** Creates a second content view over the same open book inside `container`. Returns null
     * when no book is open yet. The caller owns the returned handle's lifecycle (`destroy()`). */
    createSecondaryView(container: HTMLElement): SecondaryView | null;
    /** Resolves this book's glossary terms (D7: `epub:type="glossary"` dl/dt/dd pairs and
     * `<dfn title>` markers only - no server glossary, no user-added terms in v1). Extraction is
     * lazy and memoized per open book: nothing is scanned until the first call, so a reader who
     * never opens the Glossary tab never pays for it. Resolves to `[]` before a book is open, and
     * for a book that ships none - the empty state D7 requires. */
    getGlossaryTerms(): Promise<GlossaryTerm[]>;
    /** Resolves a note/annotation CFI to its chapter label, the same `tocItem.label` the
     * `relocate` event reports for the live reading position (U5 Defect B: a note row must never
     * show a raw CFI to the user). Memoized per CFI and bounded by the caller to the visible
     * window only (src/shell/notes/mount.ts) - this must never be run over a whole note list,
     * which can be thousands of rows (WORKTREE_BRIEF.md hard rule 5). Resolves to `null` if no
     * book is open or the lookup fails (e.g. a synthetic/invalid CFI), letting the caller fall
     * back to the annotation type label only. */
    getChapterTitleForCfi(cfi: string): Promise<string | null>;
    /** Subscribes to inline glossary term activations (tap, or Enter/Space while focused) in the
     * main view or a Context mini-reader created via `createSecondaryView`. Not a protocol v1/v2
     * message: this is a same-process shell<->core hook, same class of addition as
     * `createSecondaryView` (WORKTREE_BRIEF.md rule 2/4 - no private access, but Reactor's own
     * shell and core share one JS runtime, unlike the host boundary the wire protocol crosses). */
    onGlossaryTermTap(listener: (term: string, rect: GlossaryTapRect) => void): () => void;
    private emitGlossaryTermTap;
    /** Re-marks whichever sections are already rendered once extraction resolves, so a page that
     * loaded before the glossary promise settled still gets its terms underlined without waiting
     * for the next page turn. */
    private remarkLoadedDocs;
}
export {};
