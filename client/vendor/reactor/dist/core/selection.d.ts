import type { ViewportRect } from '../protocol/v1/events.js';
import type { FoliateRenderer } from './foliate-types.js';
/** A range's bounding box in the WebView's own viewport coordinates (CSS px == dp). */
export declare function viewportRect(range: Range): ViewportRect;
export declare function clearSelection(renderer: FoliateRenderer | null | undefined): void;
export interface DocHandlerCallbacks {
    /** Resolves a range to a CFI for the section at `index`; mirrors `view.getCFI(index, range)`. */
    getCFI(range: Range): string | null;
    onTap(x: number, y: number): void;
    onSelection(text: string, cfi: string | null, rect: ViewportRect): void;
    onSelectionCleared(): void;
    /** performance.now() of the last time foliate's own click listener reported a tap on an
     * existing highlight, so a tap on the same spot doesn't also turn the page. */
    lastAnnotationHitAt(): number;
    now(): number;
}
/**
 * Per-section-document listeners. The host does not overlay tap zones on the WebView (that
 * would block text selection), so taps are detected here and reported with their horizontal
 * position. Returns a disposer, though foliate recreates the document on every section load so
 * callers rarely need to call it.
 */
export declare function attachDocHandlers(doc: Document, callbacks: DocHandlerCallbacks): () => void;
