import type { HostChannel } from '../../host-api/index.js';
import type { NoteItem, SetNotesCommand } from '../../protocol/v2/commands.js';
import type { NoteFilter, NoteSort } from './types.js';
export declare const NOTES_PAGE_SIZE = 100;
export interface NotesQueryState {
    filter: NoteFilter;
    sort: NoteSort;
    query: string | null;
}
export declare class NotesStore {
    private readonly hostChannel;
    private total;
    private offset;
    private items;
    private state;
    private lastRequestedOffset;
    private everRequested;
    constructor(hostChannel: HostChannel);
    getState(): NotesQueryState;
    /** Resets the window and re-requests page 0 under a new filter/sort/search combination. */
    setState(next: Partial<NotesQueryState>): void;
    /** Requests the first page once, the first time the tab is activated - idempotent so
     * re-activating an already-loaded tab never re-fetches. */
    ensureInitialLoad(): void;
    rowCount(): number;
    rowAt(index: number): NoteItem | undefined;
    /** Called by the renderer with the currently visible row range; requests a new window only
     * when some of that range isn't already loaded (never requests "all of them" at once). */
    ensureLoaded(first: number, last: number): void;
    private requestPage;
    applyWindow(command: SetNotesCommand): void;
}
