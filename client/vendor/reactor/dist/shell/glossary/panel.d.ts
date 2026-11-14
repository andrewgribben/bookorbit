import type { GlossaryTerm } from '../../core/glossary.js';
export interface GlossaryPanelHandle {
    /** Replaces the full term list (called once extraction resolves). */
    setTerms(terms: GlossaryTerm[]): void;
    /** Clears any active search filter, scrolls the given term's row into view and briefly
     * flashes it - the inline popover's "Go to glossary" button uses this (SHELL.md U4 row). A
     * term absent from the current list (e.g. extraction still running) is a no-op. */
    scrollToAndFlash(term: string): void;
    destroy(): void;
}
export declare function mountGlossaryPanel(container: HTMLElement): GlossaryPanelHandle;
