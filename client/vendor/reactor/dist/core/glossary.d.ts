import type { FoliateBook } from './foliate-types.js';
export interface GlossaryTerm {
    term: string;
    definition: string;
}
/** A plain, serialisable rect in page coordinates (not a live `DOMRect`), used to place the
 * inline popover without the shell needing to know the book content lives in a nested
 * iframe/shadow-root (src/shell/glossary/popover.ts does that translation once). */
export interface GlossaryTapRect {
    left: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}
export declare const GLOSSARY_INLINE_CLASS = "rx-glossary-term";
/** One document's worth of glossary entries. Looks for every `dl` inside (or carrying) an
 * `epub:type="glossary"` container, plus standalone `<dfn title="...">` markers (the other
 * convention D7 names) anywhere in the document. */
export declare function extractGlossaryFromDocument(doc: Document): GlossaryTerm[];
/** Scans every section of `book` for glossary content (D7), in bounded batches. A section that
 * fails to parse (or has no `createDocument`, e.g. an unexpected format) is skipped rather than
 * failing the whole extraction, mirroring narration.ts's per-section tolerance. Returns `[]` for
 * a book with none - the empty state D7 requires. */
export declare function extractGlossaryFromBook(book: FoliateBook): Promise<GlossaryTerm[]>;
/** Marks every occurrence of a known glossary term inside `doc`'s text with an inline, keyboard-
 * reachable span (SHELL.md U4 row: dotted underline, `tabindex=0 role=button`), and reports a
 * tap/Enter/Space activation through `onTap` with the term's page-coordinate rect for popover
 * placement. Idempotent per document: a second call (e.g. once a lazily-started extraction
 * resolves after the section already rendered) is a no-op if the doc was already marked, and a
 * call with an empty `terms` list never marks (so an empty-glossary book's reading surface is
 * untouched, and the attribute is only set once there is something worth finding). */
export declare function markGlossaryTermsInDoc(doc: Document, terms: GlossaryTerm[], onTap: (term: string, rect: GlossaryTapRect) => void): void;
/** Minimal visual cue for an inline glossary term (dotted underline, SHELL.md U4 row), injected
 * straight into the content document same as narration.ts's injectDefaultNarrationStyle - the
 * shell's own `<style>` tag never reaches into the book's own iframe document. */
export declare function injectGlossaryInlineStyle(doc: Document): void;
