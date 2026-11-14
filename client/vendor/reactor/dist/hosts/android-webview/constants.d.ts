/** The WebViewAssetLoader page Reactor's bundle must load as. */
export declare const ANDROID_READER_PAGE_URL = "https://appassets.androidplatform.net/assets/reader/index.html";
/** The @JavascriptInterface name events are posted to; `index.html` shims
 * `window.ReactNativeWebView.postMessage` onto it. */
export declare const ANDROID_READER_JS_INTERFACE_NAME = "AndroidReaderBridge";
/** Base URL LocalEpubAssetHandler serves the lazy open path's entries.json/entry/<name> from. */
export declare const ANDROID_LOCAL_EPUB_BASE_URL = "https://appassets.androidplatform.net/local-epub/";
export declare function androidLocalEpubEntriesUrl(): string;
export declare function androidLocalEpubEntryUrl(name: string): string;
