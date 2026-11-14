import type { FoliateBook } from './foliate-types.js';
import { type GlossaryTapRect, type GlossaryTerm } from './glossary.js';
export interface SecondaryViewOptions {
    /** Glossary terms known at the moment a page loads (SHELL.md U3 row: "content follows same
     * glossary/link affordances as main text"). Read fresh on every `load` rather than captured
     * once, so a page opened before extraction finishes still gets marked on its *next* load. */
    getGlossaryTerms?: () => GlossaryTerm[];
    onGlossaryTermTap?: (term: string, rect: GlossaryTapRect) => void;
}
export interface SecondaryViewEvent {
    type: 'relocate' | 'error';
    cfi: string | null;
    fraction: number | null;
    chapterTitle: string | null;
    message?: string;
}
export interface SecondaryView {
    /** Navigates to a CFI, href or other foliate-resolvable target (search hit, footnote href). */
    goTo(target: string): Promise<void>;
    getCurrentCfi(): string | null;
    on(listener: (event: SecondaryViewEvent) => void): () => void;
    /** Removes the secondary `<foliate-view>` and stops emitting. Does not touch the main view
     * or the shared book instance. */
    destroy(): void;
}
/** Creates a secondary view over `book` inside `container`. `book` must come from
 * `ContentCore.getOpenBook()` - a fresh `EPUB`/book instance here would defeat D8/S2. Scrolled
 * flow only (SHELL.md U3 row: "Context mini-page ... never paginates"). */
export declare function createSecondaryView(container: HTMLElement, book: FoliateBook, options?: SecondaryViewOptions): SecondaryView;
