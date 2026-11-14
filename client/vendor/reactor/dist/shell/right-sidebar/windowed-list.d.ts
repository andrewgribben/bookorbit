export interface WindowedListOptions {
    container: HTMLElement;
    rowHeight: number;
    buffer?: number;
    rowCount(): number;
    renderRow(index: number): HTMLElement;
}
export declare class WindowedList {
    private readonly container;
    private readonly rowHeight;
    private readonly buffer;
    private readonly opts;
    private readonly topSpacer;
    private readonly bottomSpacer;
    private readonly rowsEl;
    private readonly onScroll;
    private destroyed;
    constructor(opts: WindowedListOptions);
    /** The row index range currently rendered, inclusive-exclusive - exposed only for tests that
     * want to assert bounded node counts without depending on DOM child counts specifically. */
    visibleRange(): {
        first: number;
        last: number;
    };
    render(): void;
    destroy(): void;
}
