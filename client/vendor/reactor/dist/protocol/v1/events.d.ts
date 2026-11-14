export interface TocItem {
    label: string;
    href: string | null;
    subitems: TocItem[];
}
export interface ViewportRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export interface SearchHit {
    cfi: string;
    pre: string;
    match: string;
    post: string;
}
export interface NarrationTimelineItem {
    sectionIndex: number;
    textHref: string;
    beginSec: number;
    endSec: number | null;
    audioIndex: number;
}
export type ReaderEvent = {
    type: 'ready';
} | {
    type: 'loaded';
    toc: TocItem[];
    metadata: {
        title: string | Record<string, string> | null;
        language: string | string[] | null;
    };
    hasMediaOverlay: boolean;
    isRtl: boolean;
} | {
    type: 'relocate';
    cfi: string | null;
    fraction: number | null;
    chapterTitle: string | null;
    /** Foliate's own location object. Opaque to the protocol; Kotlin ignores it today but it
     * is kept on the wire (PLAN.md correction #2). */
    location: unknown;
    reason: string | null;
    restoring: boolean;
    narrationFragment: string | null;
    narrationSectionIndex: number | null;
} | {
    type: 'history';
    canGoBack: boolean;
    canGoForward: boolean;
} | {
    type: 'error';
    message: string;
} | {
    type: 'tap';
    x: number;
    y: number;
} | {
    type: 'selection';
    text: string;
    cfi: string | null;
    rect: ViewportRect;
} | {
    type: 'selectionCleared';
} | {
    type: 'searchResults';
    label: string;
    items: SearchHit[];
} | {
    type: 'searchProgress';
    progress: number;
} | {
    type: 'searchDone';
    total: number;
    capped: boolean;
} | {
    type: 'annotationTap';
    cfi: string | null;
    rect: ViewportRect | null;
} | {
    type: 'narrationTimeline';
    generation: number;
    audioSrcs: string[];
    items: NarrationTimelineItem[];
    activeClass: string;
    playbackActiveClass: string | null;
    startTextHref: string;
} | {
    type: 'narrationTimelineError';
    generation: number;
    message: string;
};
export declare const READER_EVENT_TYPES: readonly ["ready", "loaded", "relocate", "history", "error", "tap", "selection", "selectionCleared", "searchResults", "searchProgress", "searchDone", "annotationTap", "narrationTimeline", "narrationTimelineError"];
/** Narrow-by-type validators, one per event, plus the dispatching `isReaderEvent`. */
export declare const readerEventValidators: {
    [K in ReaderEvent['type']]: (v: Record<string, unknown>) => boolean;
};
export declare function isReaderEvent(v: unknown): v is ReaderEvent;
/** Parses one posted event JSON string. Returns null for malformed JSON or an event that fails
 * its shape check (an unrecognised `type` included - unlike commands, nothing here downgrades
 * gracefully; a host decides what "unknown event" means for it). */
export declare function parseReaderEvent(json: string): ReaderEvent | null;
