import type { FoliateBook, FoliateSection } from './foliate-types.js';
/** EPUB 3 spec default for `book.media.activeClass` when the package doesn't set one. */
export declare const DEFAULT_ACTIVE_CLASS = "-epub-media-overlay-active";
/** Read-aloud highlight colour used whenever the reader draws its own. */
export declare const NARRATION_HIGHLIGHT = "rgba(255, 214, 10, 0.4)";
/** How long a manual page turn pauses narration's auto-follow before it resumes. */
export declare const NARRATION_FOLLOW_PAUSE_MS = 10000;
/** Attribute marking the injected default narration highlight `<style>` element. Renamed from
 * the legacy reader's internal attribute name (PLAN.md correction #7, SPEC.md D11). */
export declare const NARRATION_STYLE_ATTR = "data-reactor-narration";
export interface SmilPar {
    textHref: string;
    audioSrc: string;
    beginSec: number;
    endSec: number | null;
}
export interface NarrationTimelineItem {
    sectionIndex: number;
    textHref: string;
    beginSec: number;
    endSec: number | null;
    audioIndex: number;
}
export interface NarrationTimeline {
    audioSrcs: string[];
    items: NarrationTimelineItem[];
    activeClass: string;
    playbackActiveClass: string | null;
    startTextHref: string;
}
/** Ported from epub.js's internal (unexported) `parseClock` - MediaOverlay#loadSMIL uses the
 * same helper, but it is module-private, so narration timing is parsed independently here. */
export declare function parseSmilClock(str: string | null | undefined): number | undefined;
export declare function resolveSmilRef(url: string | null, relativeTo: string): string | null;
/** Parses one section's SMIL file into its `<par>` entries. Never throws - an unreadable or
 * malformed SMIL file just contributes no entries, so one bad section can't sink the whole book. */
export declare function parseSectionSmil(book: FoliateBook, section: FoliateSection | undefined): Promise<SmilPar[]>;
export interface BuildTimelineInput {
    book: FoliateBook;
    currentSectionHref: string | null;
    currentRange: Range | null | undefined;
}
/** Per-section parsed SMIL items, keyed by foliate's section object so a reopened book starts clean. */
export declare class NarrationController {
    private sectionSmilCache;
    private prepareToken;
    private lastManualNavAt;
    /** Bumps on a new `narrationPrepare` or a `narrationCancelPrepare`; the returned token lets the
     * caller detect a `buildTimeline` run abandoned by a newer prepare/cancel before it resolves. */
    nextPrepareToken(): number;
    cancelPrepare(): void;
    isCurrentPrepareToken(token: number): boolean;
    markManualNav(now: number): void;
    /** Whether narration's auto-follow should stay paused given `now` (performance.now()-like). */
    isFollowPaused(now: number): boolean;
    /** Builds the whole book's narration timeline by parsing every section's SMIL file, in natural
     * reading order. Results are assembled in section order regardless of fetch completion order. */
    buildTimeline(input: BuildTimelineInput): Promise<NarrationTimeline | null>;
    /** `{ fragment, sectionIndex }` of the first narrated sentence on the page in [range], or null
     * for a section without media overlays. */
    narrationLocator(book: FoliateBook, sectionIndex: number | null | undefined, range: Range | null | undefined): Promise<{
        fragment: string;
        sectionIndex: number;
    } | null>;
}
/** textHref of the first narrated element that ends at or after the top of the visible page. */
export declare function firstVisibleTextHref(items: Array<{
    sectionIndex: number;
    textHref: string;
}>, sectionIndex: number, range: Range | null | undefined): string | null;
declare function narrationHighlightSelector(narrationActiveClass: string | null): string;
export { narrationHighlightSelector };
/** Injects a default highlight style for the book's active-overlay class into a freshly loaded
 * section, unless the book's own stylesheet already styles that class. */
export declare function injectDefaultNarrationStyle(doc: Document | null | undefined, narrationActiveClass: string | null): void;
