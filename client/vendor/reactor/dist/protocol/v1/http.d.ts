/** One row of `entries.json`: a zip entry's name and uncompressed size. */
export interface LocalEpubEntry {
    name: string;
    size: number;
}
export declare function isLocalEpubEntry(v: unknown): v is LocalEpubEntry;
export declare function isLocalEpubEntryList(v: unknown): v is LocalEpubEntry[];
/** Path, relative to the lazy open base URL passed as __readerOpenLocal's second argument,
 * that lists every entry in the opened book. Response body: `LocalEpubEntry[]`. */
export declare const LOCAL_EPUB_ENTRIES_PATH = "entries.json";
/** Path prefix, relative to the same base URL, serving one entry's bytes. `name` is
 * per-path-segment percent-encoded (so a `/` inside an entry name does not create extra
 * segments); the response must honour a `Range` request header with a 206 partial response. */
export declare const LOCAL_EPUB_ENTRY_PATH_PREFIX = "entry/";
export declare function localEpubEntryPath(name: string): string;
