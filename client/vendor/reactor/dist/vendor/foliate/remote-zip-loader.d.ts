/**
 * Lazily opens a plain remote EPUB (BO-41) over HTTP Range: unlike local-zip-loader.js, there is
 * no server-side entries manifest and no per-entry endpoint - `url` is the EPUB file's own URL,
 * served by any ordinary HTTP(S) host (e.g. the web client's API, a CDN, a signed S3 URL). This
 * reads the zip's central directory and each entry's bytes straight out of the remote file via
 * `Range` requests, the same way view.js's makeZipLoader reads a local Blob, so peak memory stays
 * proportional to the current section, never the whole book (WORKTREE_BRIEF.md hard rule 5).
 *
 * Falls back to exactly one whole-file fetch only when the server does not honour `Range` with a
 * 206 response (some static hosts and proxies strip or ignore it). A server that answers the
 * probe with a plain 200 has that response's body reused as the fallback blob, so the fallback
 * never costs a second request.
 *
 * @param {string} url - the EPUB file's own URL (the file itself, not a base path).
 * @param {typeof fetch} [fetcher] - caller-supplied replacement for the global `fetch` (mirrors
 *   makeLocalZipLoader's R-G5 fetcher), so a host behind auth can add an `Authorization` header
 *   on every request, including the Range reads. Defaults to the global `fetch`.
 * @param {number} [knownSize] - total byte size of the file, if the caller already knows it
 *   (e.g. from server metadata). Saves the one-time size probe below.
 * @returns {Promise<Object>} Loader interface compatible with Foliate's EPUB class (loadText,
 *   loadBlob, getSize), plus `entries` (the zip central directory) and `bytesTransferred()`,
 *   a running total of response bytes actually read over the wire (test/diagnostics only).
 */
export class RangeUnsupportedError extends Error {
    constructor(message: any, blob?: null);
    blob: any;
}
export function makeRemoteZipLoader(url: any, fetcher: typeof fetch | undefined, knownSize: any): Promise<{
    entries: any;
    loadText: (name: any, ...args: any[]) => any;
    loadBlob: (name: any, ...args: any[]) => any;
    getSize: (name: any) => any;
    bytesTransferred: () => any;
}>;
export default makeRemoteZipLoader;
