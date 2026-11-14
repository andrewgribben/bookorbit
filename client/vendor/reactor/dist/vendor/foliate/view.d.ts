export function getKoboSpanValue(range: any): any;
export function getKoreaderDocFragmentIndex(sections: any, index: any): number | null;
export function getKoreaderProgress(docFragmentIndex: any, range: any): string | null;
export class ResponseError extends Error {
}
export class NotFoundError extends Error {
}
export class UnsupportedTypeError extends Error {
}
export function makeBook(file: any): Promise<any>;
export function makeStreamingBook(bookId: number, baseUrl: string, bookInfo: Object, authToken?: string, bookType?: string, fileId?: number | null): Promise<typeof import("./epub.js").EPUB>;
export class View extends HTMLElement {
    isFixedLayout: boolean;
    lastLocation: any;
    history: History;
    open(book: any): Promise<void>;
    book: any;
    language: {
        canonical?: undefined;
        locale?: undefined;
        isCJK?: undefined;
        direction?: undefined;
    } | {
        canonical: string | undefined;
        locale: Intl.Locale;
        isCJK: boolean;
        direction: any;
    } | undefined;
    renderer: HTMLElement | undefined;
    mediaOverlay: any;
    _narrationNav: boolean | undefined;
    close(): void;
    tts: import("./tts.js").TTS | null | undefined;
    goToTextStart(): Promise<any>;
    init({ lastLocation, showTextStart }: {
        lastLocation: any;
        showTextStart: any;
    }): Promise<void>;
    addAnnotation(annotation: any, remove: any): Promise<{
        index: any;
        label: any;
    } | undefined>;
    deleteAnnotation(annotation: any): Promise<{
        index: any;
        label: any;
    } | undefined>;
    showAnnotation(annotation: any): Promise<void>;
    getCFI(index: any, range: any): any;
    resolveCFI(cfi: any): any;
    resolveNavigation(target: any): any;
    goTo(target: any): Promise<any>;
    goToFraction(frac: any): Promise<void>;
    select(target: any): Promise<void>;
    deselect(): void;
    getSectionFractions(): any;
    getProgressOf(index: any, range: any): {
        tocItem: any;
        pageItem: any;
    };
    getTOCItemOf(target: any): Promise<any>;
    prev(distance: any): Promise<void>;
    next(distance: any): Promise<void>;
    goLeft(): Promise<void>;
    goRight(): Promise<void>;
    search(opts: any): AsyncGenerator<"done" | {
        cfi: any;
        excerpt: any;
    } | {
        progress: number;
        index?: undefined;
        subitems?: undefined;
    } | {
        index: any;
        subitems: {
            cfi: any;
            excerpt: any;
        }[];
        progress?: undefined;
    } | {
        label: any;
        subitems: any;
    }, void, unknown>;
    clearSearch(): void;
    initTTS(granularity: string | undefined, highlight: any): Promise<void>;
    startMediaOverlay(): any;
    #private;
}
declare class History extends EventTarget {
    pushState(x: any): void;
    replaceState(x: any): void;
    back(): void;
    forward(): void;
    get canGoBack(): boolean;
    get canGoForward(): boolean;
    clear(): void;
    #private;
}
export {};
