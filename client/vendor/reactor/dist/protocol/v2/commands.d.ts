import { type ReaderSettings } from '../v1/settings.js';
export interface ConfigureInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
/** Presence-driven chrome gating (SHELL.md section 7 Q2, adopted): a tab/control's existence is
 * decided once, from this object at the first `configure`, never from a later `set*` data call
 * arriving (that would be a data update, not a presence toggle). `userGlossary` is the G1 hook;
 * G1 itself stays DRAFT (blocked on design), this flag only lets a host say "not yet". */
export interface ConfigureCapabilities {
    starred: boolean;
    related: boolean;
    glossary: boolean;
    notes: boolean;
    bookmarks: boolean;
    playback: boolean;
    userGlossary: boolean;
}
export interface ConfigureCommand {
    type: 'configure';
    chrome: 'reactor' | 'host';
    eink: boolean;
    insets: ConfigureInsets;
    capabilities: ConfigureCapabilities;
    locale: string;
}
export interface BookmarkItem {
    cfi: string;
    label: string | null;
    createdAt: string;
}
export interface SetBookmarksCommand {
    type: 'setBookmarks';
    items: BookmarkItem[];
}
export interface SetStarredCommand {
    type: 'setStarred';
    bookIds: string[];
}
export interface RelatedBookItem {
    id: string;
    title: string;
    coverUrl: string | null;
}
export interface SetRelatedCommand {
    type: 'setRelated';
    items: RelatedBookItem[];
}
export type NoteKind = 'highlight' | 'underline' | 'note' | 'bookmark';
export interface NoteItem {
    id: string;
    cfi: string;
    kind: NoteKind;
    color: string | null;
    style: string | null;
    text: string | null;
    note: string | null;
    createdAt: string;
}
/** Windowed, never a full snapshot (WORKTREE_BRIEF.md rule 5): a host with thousands of notes
 * sends one window at a time, addressed by `offset`, and Reactor asks for another window with
 * the `notesPageRequest` intent (./intents.ts). Reactor must never hold more than one window in
 * memory - see src/host-api, which keeps only the latest one. */
export interface SetNotesCommand {
    type: 'setNotes';
    total: number;
    offset: number;
    items: NoteItem[];
}
export interface SetPlaybackStateCommand {
    type: 'setPlaybackState';
    playing: boolean;
    positionSec: number;
    rate: number;
}
export interface SetSettingsScopeCommand {
    type: 'setSettingsScope';
    scope: 'global' | 'book';
    settings: ReaderSettings;
}
export type ReaderCommandV2 = ConfigureCommand | SetBookmarksCommand | SetStarredCommand | SetRelatedCommand | SetNotesCommand | SetPlaybackStateCommand | SetSettingsScopeCommand;
export declare const READER_COMMAND_V2_TYPES: readonly ["configure", "setBookmarks", "setStarred", "setRelated", "setNotes", "setPlaybackState", "setSettingsScope"];
export declare function isNoteKind(v: unknown): v is NoteKind;
/** Narrow-by-type validators, one per v2 command, plus the dispatching `isReaderCommandV2`. */
export declare const readerCommandV2Validators: {
    [K in ReaderCommandV2['type']]: (v: Record<string, unknown>) => boolean;
};
export declare function isReaderCommandV2(v: unknown): v is ReaderCommandV2;
/** Parses one v2 command's JSON string, e.g. the same `__readerCommand` string argument a v1
 * command arrives through on a WebView-embedding host (README.md "Transport"). Returns null for
 * malformed JSON or an unrecognised/invalid command - the same leniency as v1's
 * `parseReaderCommand`, so a channel can try v1 then v2 (or vice versa) without special-casing
 * an unknown `type` itself. */
export declare function parseReaderCommandV2(json: string): ReaderCommandV2 | null;
