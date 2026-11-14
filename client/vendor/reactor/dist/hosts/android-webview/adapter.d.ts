declare global {
    interface Window {
        AndroidReaderBridge?: {
            postMessage: (json: string) => void;
        };
        ReactNativeWebView?: {
            postMessage: (json: string) => void;
        };
        __readerBegin?: (metaJson: string) => void;
        __readerChunk?: (b64: string) => void;
        __readerCommit?: () => void;
        __readerOpenLocal?: (metaJson: string, baseUrl: string) => void;
        __readerCommand?: (json: string) => void;
        __reactorVersion?: {
            version: string;
            commit: string;
            builtAt: string | null;
        };
    }
}
export {};
