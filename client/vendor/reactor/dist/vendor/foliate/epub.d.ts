export class EPUB {
    constructor({ loadText, loadBlob, getSize, getDirectUrl, sha1 }: {
        loadText: any;
        loadBlob: any;
        getSize: any;
        getDirectUrl: any;
        sha1: any;
    });
    parser: DOMParser;
    loadText: any;
    loadBlob: any;
    getSize: any;
    init(): Promise<this>;
    resources: Resources | undefined;
    transformTarget: any;
    sections: ({
        id: any;
        load: () => any;
        unload: () => any;
        createDocument: () => Promise<Document>;
        size: any;
        cfi: any;
        linear: any;
        pageSpread: string | undefined;
        resolveHref: (href: any) => any;
        mediaOverlay: any;
    } | null)[] | undefined;
    toc: any;
    pageList: any;
    landmarks: any;
    metadata: {
        identifier: any;
        title: any;
        sortAs: any;
        subtitle: any;
        language: any;
        description: any;
        publisher: {
            name: any;
            sortAs: any;
            role: any;
            code: any;
            scheme: any;
        } | null;
        published: any;
        modified: any;
        subject: any;
        belongsTo: {
            collection: any;
            series: {
                name: any;
                position: number;
            } | null;
        };
        altIdentifier: any;
        source: any;
        rights: any;
    } | undefined;
    rendition: {} | undefined;
    media: {
        duration: any;
    } | undefined;
    dir: any;
    loadDocument(item: any): Promise<Document>;
    getMediaOverlay(): MediaOverlay;
    resolveCFI(cfi: any): {
        index: number;
        anchor: (doc: any) => any;
    };
    resolveHref(href: any): {
        index: number;
        anchor: (doc: any) => any;
    } | null;
    splitTOCHref(href: any): any;
    getTOCFragment(doc: any, id: any): any;
    isExternal(uri: any): boolean;
    getCover(): Promise<Blob | null>;
    getCalibreBookmarks(): Promise<any>;
    destroy(): void;
    #private;
}
declare class Resources {
    constructor({ opf, resolveHref }: {
        opf: any;
        resolveHref: any;
    });
    opf: any;
    manifest: any[];
    manifestById: Map<any, any>;
    spine: any[];
    pageProgressionDirection: any;
    navPath: any;
    ncxPath: any;
    guide: {
        label: any;
        type: any;
        href: any;
    }[] | undefined;
    cover: any;
    cfis: any[];
    getItemByID(id: any): any;
    getItemByHref(href: any): any;
    getItemByProperty(prop: any): any;
    resolveCFI(cfi: any): {
        index: number;
        anchor: (doc: any) => any;
    };
}
declare class MediaOverlay extends EventTarget {
    constructor(book: any, loadXML: any);
    book: any;
    loadXML: any;
    start(sectionIndex: any, filter?: () => boolean): any;
    pause(): void;
    resume(): void;
    stop(): void;
    prev(): void;
    next(): void;
    setVolume(volume: any): void;
    setRate(rate: any): void;
    #private;
}
export {};
