export type ContextStackEntry = {
    kind: 'blank';
} | {
    kind: 'results';
} | {
    kind: 'page';
    target: string;
    label: string | null;
};
export declare class ContextHistory {
    private stack;
    private index;
    get current(): ContextStackEntry;
    get canGoBack(): boolean;
    get canGoForward(): boolean;
    /** Pushes a new entry, discarding any forward history (normal browser-style navigation). A
     * push that repeats the current entry is a no-op, so re-opening the same result twice doesn't
     * pad the stack. */
    push(entry: ContextStackEntry): void;
    back(): ContextStackEntry | null;
    forward(): ContextStackEntry | null;
    /** Back to the pre-search blank state, dropping all forward history (closing the panel or
     * clearing search both reset to blank per SHELL.md's breadcrumb order: page -> results ->
     * blank). */
    reset(): void;
}
