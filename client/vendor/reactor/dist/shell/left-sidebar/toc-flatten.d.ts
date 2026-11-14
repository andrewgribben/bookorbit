import type { TocItem } from '../../protocol/v1/events.js';
export interface FlatTocNode {
    /** Stable id: dot-joined child index path ("0", "0.2", "0.2.1", ...), unique per node and
     * stable across re-flattens as long as the TOC shape doesn't change. */
    id: string;
    label: string;
    href: string | null;
    depth: number;
    hasChildren: boolean;
    parentId: string | null;
}
/** Depth-first flatten of the whole tree (every node, expanded or not - collapsing is a
 * rendering-time filter over this flat list, see `visibleTocNodes`). */
export declare function flattenToc(items: TocItem[], parentId?: string | null, depth?: number): FlatTocNode[];
/** Filters the flat list down to rows actually visible given a set of collapsed node ids: a
 * node is hidden whenever any ancestor of it is collapsed. `collapsed` holds ids of nodes whose
 * children are hidden (default: everything expanded, matching the mockup's default-open tree). */
export declare function visibleTocNodes(flat: FlatTocNode[], collapsed: ReadonlySet<string>): FlatTocNode[];
/** Finds the flat node whose href matches the current reading position (`relocate.cfi`'s
 * section, approximated here by exact href match - the shell is only ever given hrefs it was
 * handed itself, so exact match is correct and cheap). Returns null when nothing matches, e.g.
 * before the first `relocate` event or for a book with no TOC. */
export declare function findCurrentTocId(flat: FlatTocNode[], currentHref: string | null): string | null;
/** Fallback matcher for when a host has no href to report for the current position (protocol
 * v1's `relocate` event only carries `chapterTitle`, not the TOC href - see
 * src/protocol/v1/events.ts). Matches by exact label text; returns null on no match or when the
 * label is empty/ambiguous (more than one node sharing the label matches the first occurrence,
 * same as the href matcher's behaviour). */
export declare function findCurrentTocIdByLabel(flat: FlatTocNode[], chapterTitle: string | null): string | null;
/** Windowing math (hard rule 5): given a scroll position and row height, returns the inclusive
 * start/end indices to actually render, with overscan on both sides so a fast scroll never shows
 * a blank flash before the next frame's render catches up. */
export declare function computeWindow(scrollTop: number, rowHeight: number, viewportHeight: number, totalCount: number, overscan?: number): {
    start: number;
    end: number;
};
