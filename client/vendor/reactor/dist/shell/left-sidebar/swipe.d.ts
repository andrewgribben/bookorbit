export type SwipeRegion = 'sidebar' | 'book' | 'other';
export interface SwipeResult {
    action: 'cycle-next' | 'cycle-prev' | 'close' | null;
}
/** Minimum horizontal travel, in px, before a drag counts as a swipe rather than a tap/scroll. */
export declare const SWIPE_THRESHOLD_PX = 40;
/** Resolves a completed drag (dx/dy = end minus start) given where it started and whether this
 * sidebar is currently overlaying the book (close-on-swipe only applies while overlaying -
 * SHELL.md section 2's docked sizes never close this way, since there's nothing to close). */
export declare function resolveSwipe(startRegion: SwipeRegion, dx: number, dy: number, isOverlaying: boolean): SwipeResult;
/** Classifies where a pointer-down landed: inside the sidebar's own DOM subtree, inside the
 * book column element, or neither (e.g. the scrim, a bar button). */
export declare function classifySwipeStart(startTarget: Node | null, sidebarEl: Element, bookEl: Element): SwipeRegion;
