import type { ContentCore } from '../../core/content-core.js';
import type { HostChannel } from '../../host-api/index.js';
export type NoteFilter = 'all' | 'highlight' | 'underline' | 'note' | 'handwritten' | 'bookmark';
export type NoteSort = 'position' | 'date' | 'colour' | 'type';
export interface NotesOptions {
    eink?: boolean;
}
export interface NotesHandle {
    /** Call when the Notes tab becomes visible; lazily requests the first page the first time. */
    onActivate(): void;
    /** Re-measures and re-renders the windowed list (container was just resized or un-hidden). */
    refresh(): void;
    destroy(): void;
}
export interface MountNotesArgs {
    container: HTMLElement;
    core: ContentCore;
    hostChannel: HostChannel;
    options?: NotesOptions;
}
