export interface NotesDomElements {
    root: HTMLElement;
    searchBar: HTMLElement;
    searchInput: HTMLInputElement;
    filterRow: HTMLElement;
    filterButtons: Record<string, HTMLButtonElement>;
    sortSelect: HTMLSelectElement;
    capabilityBanner: HTMLElement;
    listScroller: HTMLElement;
}
export declare function buildNotesDom(doc: Document): NotesDomElements;
