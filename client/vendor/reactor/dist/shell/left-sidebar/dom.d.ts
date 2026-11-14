export interface LeftSidebarElements {
    root: HTMLElement;
    scrim: HTMLElement;
    backBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
    title: HTMLElement;
    tablist: HTMLElement;
    tabContents: HTMLButtonElement;
    tabStarred: HTMLButtonElement;
    tabRelated: HTMLButtonElement;
    body: HTMLElement;
    panelContents: HTMLElement;
    tocScroll: HTMLElement;
    tocSpacer: HTMLElement;
    tocWindow: HTMLElement;
    panelStarred: HTMLElement;
    panelRelated: HTMLElement;
}
export declare function buildLeftSidebarDom(container: HTMLElement): LeftSidebarElements;
