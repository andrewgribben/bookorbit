export interface ShellElements {
    root: HTMLElement;
    zones: HTMLElement;
    zoneLeft: HTMLElement;
    zoneCentre: HTMLElement;
    zoneRight: HTMLElement;
    topBar: HTMLElement;
    bottomBar: HTMLElement;
    contentsBtn: HTMLButtonElement;
    bookmarkBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
    contextBtn: HTMLButtonElement;
    historyBackBtn: HTMLButtonElement;
    historyForwardBtn: HTMLButtonElement;
    chapterLabel: HTMLElement;
    scrubber: HTMLInputElement;
}
export declare function buildShellDom(container: HTMLElement): ShellElements;
