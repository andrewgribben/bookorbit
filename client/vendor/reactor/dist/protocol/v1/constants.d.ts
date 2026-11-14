export declare const READER_GLOBALS: {
    /** `(metaJson: string) => void` - begins a streamed open; see ./meta.ts for the payload. */
    readonly begin: "__readerBegin";
    /** `(base64: string) => void` - one chunk of the file started by `begin`. */
    readonly chunk: "__readerChunk";
    /** `() => void` - finishes the transfer started by `begin`/`chunk`* and opens it. */
    readonly commit: "__readerCommit";
    /** `(metaJson: string, baseUrl: string) => void` - lazy zip open; see ./http.ts for `baseUrl`'s
     * shape. */
    readonly openLocal: "__readerOpenLocal";
    /** `(commandJson: string) => void` - everything else; see ./commands.ts. */
    readonly command: "__readerCommand";
};
