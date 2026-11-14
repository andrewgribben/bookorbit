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
export interface FoliateContent {
    doc?: Document;
}
export interface FoliateRenderer {
    setAttribute(name: string, value: string): void;
    setStyles?: (css: string) => void;
    getContents?: () => FoliateContent[];
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
    mediaOverlay?: FoliateMediaOverlayController;
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
