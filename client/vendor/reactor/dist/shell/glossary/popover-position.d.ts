export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}
export interface PopoverPosition {
    /** Left offset from the stage's own left edge. */
    left: number;
    /** Top offset from the stage's own top edge. */
    top: number;
    /** True when there wasn't room below the anchor and the popover opened upward instead. */
    above: boolean;
    /** Arrow tip offset from the popover's own left edge, clamped to stay over the popover body. */
    arrowX: number;
}
/** Places a popover of `popoverWidth` x `popoverHeight` next to `anchor`, both already expressed
 * relative to `stage` (the shell root's own box) - callers in page coordinates must subtract
 * `stage.left`/`stage.top` from both rects first, same as the mockup's own placement code. */
export declare function computePopoverPosition(anchor: Rect, stage: Rect, popoverWidth: number, popoverHeight: number): PopoverPosition;
