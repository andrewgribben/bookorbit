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
declare const ICON_PATHS: Record<string, string>;
export declare function icon(name: keyof typeof ICON_PATHS): string;
export declare function buildShellDom(container: HTMLElement): ShellElements;
export {};
