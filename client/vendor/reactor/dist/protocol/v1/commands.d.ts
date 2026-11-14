import { type ReaderSettings } from './settings.js';
export interface AnnotationStyle {
    cfi: string;
    color: string;
    style: string;
}
export type ReaderCommand = {
    type: 'goTo';
    target: string;
} | {
    type: 'goToFraction';
    value: number;
} | {
    type: 'prev';
} | {
    type: 'next';
} | {
    type: 'historyBack';
} | {
    type: 'historyForward';
} | {
    type: 'setSwipe';
    enabled: boolean;
} | {
    type: 'applyStyles';
    settings: ReaderSettings;
} | {
    type: 'setAnnotations';
    items: AnnotationStyle[];
} | {
    type: 'clearSelection';
} | {
    type: 'search';
    query: string;
} | {
    type: 'clearSearch';
} | {
    type: 'narrationPrepare';
    generation: number;
} | {
    type: 'narrationCancelPrepare';
} | {
    type: 'narrationHighlight';
    textHref: string;
} | {
    type: 'narrationUnhighlight';
};
export declare const READER_COMMAND_TYPES: readonly ["goTo", "goToFraction", "prev", "next", "historyBack", "historyForward", "setSwipe", "applyStyles", "setAnnotations", "clearSelection", "search", "clearSearch", "narrationPrepare", "narrationCancelPrepare", "narrationHighlight", "narrationUnhighlight"];
/** Narrow-by-type validators, one per command, plus the dispatching `isReaderCommand`. */
export declare const readerCommandValidators: {
    [K in ReaderCommand['type']]: (v: Record<string, unknown>) => boolean;
};
export declare function isReaderCommand(v: unknown): v is ReaderCommand;
/** Parses `__readerCommand`'s JSON string argument. Returns null for malformed JSON or an
 * unrecognised/invalid command, mirroring bridge.js's own `try { JSON.parse } catch { return }`
 * plus its command `switch`'s implicit `default: break` for an unknown `type`. */
export declare function parseReaderCommand(json: string): ReaderCommand | null;
