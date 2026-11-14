export interface RightSidebarElements {
    root: HTMLElement;
    resizeHandle: HTMLElement;
    tabsRow: HTMLElement;
    contextTabBtn: HTMLButtonElement;
    glossaryTabBtn: HTMLButtonElement;
    notesTabBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
    searchBar: HTMLElement;
    searchInput: HTMLInputElement;
    openInMainBtn: HTMLButtonElement;
    breadcrumb: HTMLElement;
    body: HTMLElement;
    resultsScroller: HTMLElement;
    /** Direct container for the secondary `<foliate-view>` - never wrapped or padded, same rule
     * U1's dom.ts follows for the main view. */
    contextPage: HTMLElement;
    /** The Notes tab's own panel (U5), a sibling of resultsScroller/contextPage - only one of the
     * three content panels is ever visible at a time. */
    notesBody: HTMLElement;
    /** Mount point for U4's Glossary tab panel (src/shell/glossary/panel.ts). */
    glossaryPanelMount: HTMLElement;
}
export declare function buildRightSidebarDom(hostDoc: Document): RightSidebarElements;
