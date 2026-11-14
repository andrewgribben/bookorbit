export interface BookInsets {
    left: number;
    right: number;
    /** Height (px) a bottom-docked bar reserves (U7's playback bar - SHELL.md U7 row: "does not
     * cover page text"). Defaults to 0, same as left/right, for callers that never set it. */
    bottom: number;
}
/** Sets how much width (px) the book column gives up on the given side(s) to a docked sidebar,
 * or how much height (px) it gives up at the bottom to a docked bar (U7's playback bar). Only
 * the sides present in `insets` change; pass 0 to release a side. Also exposes the same values
 * as `--rx-book-inset-left`/`--rx-book-inset-right`/`--rx-book-inset-bottom` custom properties
 * so other shell chrome (bars, tap zones) can read the same reserved space without duplicating
 * the call. */
export declare function setBookInsets(container: HTMLElement, insets: Partial<BookInsets>): BookInsets;
export declare function getBookInsets(container: HTMLElement): BookInsets;
