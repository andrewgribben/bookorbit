import { type FlatTocNode } from './toc-flatten.js';
export declare const TOC_ROW_HEIGHT = 48;
export interface TocRenderState {
    flat: FlatTocNode[];
    collapsed: Set<string>;
    currentHref: string | null;
    /** Fallback when no href is known for the current position (see findCurrentTocIdByLabel). */
    currentChapterTitle: string | null;
    starred: Set<string>;
}
export interface TocRowCallbacks {
    onActivate: (node: FlatTocNode) => void;
    onToggleExpand: (node: FlatTocNode) => void;
    onToggleStar: (node: FlatTocNode) => void;
}
/** Renders only the rows in the current scroll window into `windowEl`, positions it with a
 * transform matching the window's start offset, and sizes `spacerEl` to the full (collapsed-
 * filtered) list height so the scrollbar reflects the true list length. */
export declare function renderTocWindow(scrollEl: HTMLElement, spacerEl: HTMLElement, windowEl: HTMLElement, state: TocRenderState, cb: TocRowCallbacks): void;
