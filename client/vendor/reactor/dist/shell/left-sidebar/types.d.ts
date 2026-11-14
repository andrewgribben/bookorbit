import type { TocItem } from '../../protocol/v1/events.js';
export type LeftSidebarTab = 'contents' | 'starred' | 'related';
/** One row of the Starred list: a starred TOC entry. `href` is what `goTo` is called with. */
export interface StarredItem {
    href: string;
    label: string;
}
/** One row of the Related list (SHELL.md U2 row: cover + title/subtitle + read badge). */
export interface RelatedItem {
    id: string;
    title: string;
    subtitle?: string | null;
    coverUrl?: string | null;
    read?: boolean;
}
/** Tabs whose presence is capability-gated (SHELL.md fix #7 / §7 Q2): decided once, before
 * first paint, never flipped on later by a data callback arriving. Only `related` is gated for
 * U2; Contents and Starred are always present. */
export interface LeftSidebarCapabilities {
    related?: boolean;
}
export interface LeftSidebarOptions {
    /** E-ink mode: no animation, no translucency (SHELL.md section 1). */
    eink?: boolean;
    capabilities?: LeftSidebarCapabilities;
    /** Sidebar header "Back" control (SHELL.md §7 Q1: a dedicated `back` intent, distinct from
     * `close`). Wired to a host's v2 `back` intent once U8 lands a transport. */
    onBack?: () => void;
    /** Star/unstar a TOC entry by href (future v2 `starToggle` intent). */
    onStarToggle?: (href: string, label: string, starred: boolean) => void;
    /** Open a related book (future v2 `openRelated{id}` intent). */
    onOpenRelated?: (id: string) => void;
    /** Local sidebar-open/closed notification, ahead of U8's real `chromeState{sidebar}` wire
     * shape (mirrors U1's `ChromeState` pattern in ../types.ts). */
    onSidebarChange?: (open: boolean) => void;
}
export interface LeftSidebarHandle {
    open(): void;
    close(): void;
    isOpen(): boolean;
    /** Cycles to the next/previous tab among the tabs currently present, looping past the ends
     * (SHELL.md section 4's gesture table). Exposed for keyboard/testing in addition to swipe. */
    cycleTab(direction: 1 | -1): void;
    getActiveTab(): LeftSidebarTab;
    /** Replaces the TOC shown in Contents (called on ContentCore's `loaded` event by the host
     * integration, see mount.ts). */
    setToc(toc: TocItem[]): void;
    /** Host-supplied Starred rows (future v2 `setStarred`). */
    setStarred(items: StarredItem[]): void;
    /** Host-supplied Related rows (future v2 `setRelated`). */
    setRelated(items: RelatedItem[]): void;
    /** Updates which TOC entry is "current" (tracks ContentCore's `relocate` event, matched by
     * href against the TOC's own href field). */
    setCurrentHref(href: string | null): void;
    /** Fallback for hosts/relocate events that only carry a chapter title, not an href (protocol
     * v1's `relocate.chapterTitle` - src/protocol/v1/events.ts). Used when `setCurrentHref` has
     * no match. */
    setCurrentChapterTitle(title: string | null): void;
    destroy(): void;
}
