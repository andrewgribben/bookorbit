export type ReaderFlow = 'paginated' | 'scrolled';
export interface ReaderSettings {
    fontSize: number;
    lineHeight: number;
    fontFamily: string | null;
    paragraphSpacing: number;
    maxColumnCount: number;
    gap: number;
    maxInlineSize: number;
    maxBlockSize: number;
    justify: boolean;
    hyphenate: boolean;
    isDark: boolean;
    themeName: string;
    flow: ReaderFlow;
    useBookLayout: boolean;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    linkSideMargins: boolean;
    /** Additive v1 fields (R-G1, docs/plans/W1.md): a web client's settings panel has these but
     * the frozen legacy field list never did. Optional so every existing payload (no new fields)
     * keeps validating and producing unchanged CSS; `generateCSS` only emits a rule for a field
     * that is actually present. */
    letterSpacing?: number;
    wordSpacing?: number;
    textIndent?: number;
    fontWeight?: number;
}
export declare function isReaderFlow(v: unknown): v is ReaderFlow;
export declare function isReaderSettings(v: unknown): v is ReaderSettings;
