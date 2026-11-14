import { type ReaderSettings } from '../v1/settings.js';
import { type NoteKind } from './commands.js';
export interface AnnotationCreateIntent {
    type: 'annotationCreate';
    cfi: string;
    kind: NoteKind;
    color: string | null;
    style: string | null;
    text: string | null;
    note: string | null;
}
export interface AnnotationUpdateIntent {
    type: 'annotationUpdate';
    id: string;
    color: string | null;
    style: string | null;
    note: string | null;
}
export interface AnnotationDeleteIntent {
    type: 'annotationDelete';
    id: string;
}
export interface BookmarkToggleIntent {
    type: 'bookmarkToggle';
    cfi: string;
}
export interface StarToggleIntent {
    type: 'starToggle';
    bookId: string;
}
export interface SettingsChangeIntent {
    type: 'settingsChange';
    scope: 'global' | 'book';
    settings: ReaderSettings;
}
export interface OpenRelatedIntent {
    type: 'openRelated';
    id: string;
}
export type PlaybackAction = 'play' | 'pause' | 'seek' | 'rateChange';
export interface PlaybackIntent {
    type: 'playback';
    action: PlaybackAction;
    positionSec: number | null;
    rate: number | null;
}
/** The reader session is done, e.g. a host tearing down on process-death cleanup. Distinct
 * from `back` - see the adopted answer to SHELL.md section 7 Q1. */
export interface CloseIntent {
    type: 'close';
}
/** The sidebar header's Back control (SHELL.md U2 row, the mockup's own `host.onBack()`): the
 * host's own navigation action (e.g. pop back to the library) without ending the reader
 * session. Kept as its own intent, separate from `close`, per the adopted Q1 answer: a host may
 * need to tell "go back a screen" apart from "the reader is done" (e.g. process-death cleanup
 * only wants the latter). */
export interface BackIntent {
    type: 'back';
}
export type SidebarSide = 'none' | 'left' | 'right';
/** So the host can manage system bars and the back gesture/button without Reactor reaching
 * outside its own DOM/WebView sandbox. */
export interface ChromeStateIntent {
    type: 'chromeState';
    barsVisible: boolean;
    sidebar: SidebarSide;
}
/** Requests one window of notes (U5's windowed list; WORKTREE_BRIEF.md rule 5). `filter`/
 * `sort`/`query` are opaque strings the host interprets - kept generic since U5's exact
 * filter/sort vocabulary isn't finalised yet (an open question noted in README.md). Reactor
 * never asks for "all of them". */
export interface NotesPageRequestIntent {
    type: 'notesPageRequest';
    offset: number;
    limit: number;
    filter: string | null;
    sort: string | null;
    query: string | null;
}
export type ReaderIntentV2 = AnnotationCreateIntent | AnnotationUpdateIntent | AnnotationDeleteIntent | BookmarkToggleIntent | StarToggleIntent | SettingsChangeIntent | OpenRelatedIntent | PlaybackIntent | CloseIntent | BackIntent | ChromeStateIntent | NotesPageRequestIntent;
export declare const READER_INTENT_V2_TYPES: readonly ["annotationCreate", "annotationUpdate", "annotationDelete", "bookmarkToggle", "starToggle", "settingsChange", "openRelated", "playback", "close", "back", "chromeState", "notesPageRequest"];
/** Narrow-by-type validators, one per v2 intent, plus the dispatching `isReaderIntentV2`. */
export declare const readerIntentV2Validators: {
    [K in ReaderIntentV2['type']]: (v: Record<string, unknown>) => boolean;
};
export declare function isReaderIntentV2(v: unknown): v is ReaderIntentV2;
/** Parses one v2 intent's JSON string, e.g. the same postMessage string a v1 event arrives
 * through on a WebView-embedding host (README.md "Transport"). Returns null for malformed JSON
 * or an unrecognised/invalid intent, mirroring v1's `parseReaderEvent`. */
export declare function parseReaderIntentV2(json: string): ReaderIntentV2 | null;
