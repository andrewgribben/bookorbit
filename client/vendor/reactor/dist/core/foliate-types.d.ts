export interface FoliateMediaOverlay {
    href: string;
}
export interface FoliateSection {
    id?: string;
    mediaOverlay?: FoliateMediaOverlay;
    /** Parses this section's own content document (used by glossary extraction - see
     * src/core/glossary.ts). Every vendored format (epub.js, mobi.js, fb2.js) provides this. */
    createDocument?(): Promise<Document>;
}
export interface FoliateBookMedia {
    activeClass?: string;
    playbackActiveClass?: string;
}
export interface FoliateTocItem {
    label?: string;
    href?: string | null;
    subitems?: FoliateTocItem[];
}
export interface FoliateMetadata {
    title?: string | Record<string, string> | null;
    language?: string | string[] | null;
}
export interface FoliateBook {
    sections?: FoliateSection[];
    media?: FoliateBookMedia;
    toc?: FoliateTocItem[];
    dir?: string;
    metadata?: FoliateMetadata;
    loadText(href: string): Promise<string>;
}
export interface FoliateLastLocation {
    cfi?: string;
    source?: string;
    range?: Range;
    /** BO-46: the device-visible Kobo span id at this location (`.koboSpan[id^="kobo."]`), already
     * derived by the vendored view's own `#onRelocate`/`getKoboSpanValue` (src/vendor/foliate/
     * view.js) - a DOM-Range-at-the-visible-start walk, the same convention a web host's own
     * foliate fork uses for the equivalent fields. `koboLocationType` is `'KoboSpan'` when a span
     * was found, else null; both are null for a book that carries no Kobo spans (most EPUBs). */
    koboLocationType?: string | null;
    koboLocationValue?: string | null;
}
export interface FoliateHistory {
    canGoBack?: boolean;
    canGoForward?: boolean;
    back(): void;
    forward(): void;
    clear(): void;
    pushState(cfi: string): void;
    addEventListener(type: 'index-change', listener: () => void): void;
}
/** Minimal structural typing of the vendored `Overlayer` (src/vendor/foliate/overlayer.js) -
 * only the two methods a host-side highlight (W1-B5, synthesized TTS) needs. */
export interface FoliateOverlayer {
    add(key: string, range: Range | ((root: Node) => Range), draw: (rects: DOMRectList, options?: Record<string, unknown>) => Element, options?: Record<string, unknown>): void;
    remove(key: string): void;
}
export interface FoliateContent {
    doc?: Document;
    index?: number;
    overlayer?: FoliateOverlayer;
}
export interface FoliateRenderer {
    setAttribute(name: string, value: string): void;
    setStyles?: (css: string) => void;
    getContents?: () => FoliateContent[];
    scrollToAnchor?: (anchor: Range, select?: boolean) => Promise<void>;
}
/** The full epub.js `MediaOverlay` surface (src/vendor/foliate/epub.js) - owns real `<audio>`
 * playback itself, unlike `NarrationController` (src/core/narration.ts) which only tracks SMIL
 * timing for a host that plays audio natively. Exposed as-is (W1-B5) for a web host that wants
 * the same drop-in player the vendored foliate view already builds when a book has media
 * overlays, instead of reimplementing audio playback against `narrationPrepare`/`narrationTimeline`. */
export interface FoliateMediaOverlayFull extends EventTarget {
    start(index?: number, filter?: (item: {
        text: string;
    }, i: number, items: {
        text: string;
    }[]) => boolean): Promise<boolean>;
    pause(): void;
    resume(): void;
    stop(): void;
    next(): void;
    prev(): void;
    setRate(rate: number): void;
    setVolume(volume: number): void;
}
export interface FoliateSearchSubitem {
    cfi: string;
    excerpt?: {
        pre?: string;
        match?: string;
        post?: string;
    };
}
export interface FoliateSearchResult {
    subitems?: FoliateSearchSubitem[];
    label?: string;
    progress?: number;
}
export interface FoliateMediaOverlayController {
    dispatchEvent(event: Event): void;
}
export interface FoliateView extends HTMLElement {
    book?: FoliateBook;
    renderer?: FoliateRenderer;
    history: FoliateHistory;
    lastLocation?: FoliateLastLocation;
    mediaOverlay?: FoliateMediaOverlayController | FoliateMediaOverlayFull;
    pauseNarrationFollow?: boolean;
    _narrationNav?: boolean;
    open(input: File | FoliateBook): Promise<void>;
    goTo(target: string | number): Promise<void>;
    goToFraction?(value: number): void;
    prev?(): void;
    next?(): void;
    search(opts: {
        query: string;
    }): AsyncIterable<FoliateSearchResult | 'done'>;
    clearSearch?(): void;
    getCFI(index: number, range: Range): string;
    /** Resolves a CFI/href/fraction target to `{ index, anchor }` without navigating - the same
     * lookup `goTo`/`addAnnotation` use internally (src/vendor/foliate/view.js). `anchor` takes
     * the target section's own `Document` (from `renderer.getContents()`) and returns a `Range`.
     * Exposed (W1-B5) as a narrow escape hatch for a host's own block-highlight needs (R-G4),
     * e.g. resuming synthesized TTS at an exact CFI. */
    resolveCFI?(target: string): {
        index: number;
        anchor: (doc: Document) => Range;
    } | undefined;
    /** Starts the vendored `MediaOverlay`'s own playback at the given section index (defaults to
     * the current one). Thin wrapper the vendored view itself defines. */
    startMediaOverlay?(): unknown;
    /** Resolves a CFI/href target to its TOC entry (U5 notes: chapter label for a note row,
     * never a raw CFI shown to the user). Async since it may need to parse the target section's
     * document first - see src/vendor/foliate/view.js's own implementation. */
    getTOCItemOf?(target: string): Promise<{
        label?: string;
    } | undefined>;
    addAnnotation?(annotation: {
        value: string;
    }): Promise<unknown> | undefined;
    deleteAnnotation?(annotation: {
        value: string;
    }): Promise<unknown> | undefined;
}
