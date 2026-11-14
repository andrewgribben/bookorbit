export interface PlaybackBarElements {
    root: HTMLElement;
    skipBackBtn: HTMLButtonElement;
    playPauseBtn: HTMLButtonElement;
    skipForwardBtn: HTMLButtonElement;
    rateBtn: HTMLButtonElement;
    chapterLabel: HTMLElement;
    positionLabel: HTMLElement;
}
export declare function buildPlaybackBarDom(doc: Document): PlaybackBarElements;
