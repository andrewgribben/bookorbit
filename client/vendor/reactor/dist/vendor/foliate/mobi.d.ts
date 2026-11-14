export function isMOBI(file: any): Promise<boolean>;
export class MOBI extends PDB {
    constructor({ unzlib }: {
        unzlib: any;
    });
    unzlib: any;
    open(file: any): Promise<KF8 | MOBI6>;
    headers: any;
    decode(...args: any[]): any;
    encode(...args: any[]): any;
    loadText(index: any): any;
    loadResource(index: any): Promise<any>;
    getNCX(): Promise<any[]> | undefined;
    getMetadata(): {
        identifier: any;
        title: string;
        author: any;
        publisher: string;
        language: any;
        published: any;
        description: string;
        subject: any;
        rights: string;
        contributor: any;
    };
    getCover(): Promise<Blob | undefined>;
    #private;
}
declare class PDB {
    pdb: any;
    open(file: any): Promise<void>;
    loadRecord(index: any): any;
    loadMagic(index: any): Promise<string>;
    #private;
}
declare class KF8 {
    constructor(mobi: any);
    parser: DOMParser;
    serializer: XMLSerializer;
    transformTarget: EventTarget;
    mobi: any;
    init(): Promise<this>;
    sections: any;
    toc: any;
    landmarks: {
        label: any;
        type: string[];
        href: string;
    }[] | undefined;
    dir: any;
    rendition: {
        layout: string;
        viewport: {
            [k: string]: any;
        };
    } | undefined;
    metadata: any;
    getCover: any;
    getResourcesByMagic(keys: any): Promise<{}>;
    getGuide(): Promise<{
        label: any;
        type: string[];
        href: string;
    }[] | undefined>;
    loadResourceBlob(str: any): Promise<(Blob | HTMLElement | null)[]>;
    loadResource(str: any): Promise<any>;
    replaceResources(str: any): Promise<any>;
    loadRaw(start: any, end: any): Promise<Uint8Array<ArrayBuffer>>;
    loadFlow(index: any): Promise<Uint8Array<ArrayBuffer>> | undefined;
    loadText(section: any): Promise<any>;
    createDocument(section: any): Promise<Document>;
    loadSection(section: any): Promise<any>;
    getIndexByFID(fid: any): any;
    resolveHref(href: any): Promise<{
        index: any;
        anchor: (doc: any) => any;
    } | undefined>;
    splitTOCHref(href: any): any[];
    getTOCFragment(doc: any, { fid, off }: {
        fid: any;
        off: any;
    }): any;
    isExternal(uri: any): boolean;
    destroy(): void;
    #private;
}
declare class MOBI6 {
    constructor(mobi: any);
    parser: DOMParser;
    serializer: XMLSerializer;
    mobi: any;
    init(): Promise<this>;
    sections: any;
    landmarks: {
        label: string | null;
        type: string[] | undefined;
        href: string;
    }[] | undefined;
    toc: any;
    metadata: any;
    getCover: any;
    getGuide(): Promise<{
        label: string | null;
        type: string[] | undefined;
        href: string;
    }[]>;
    loadResource(index: any): Promise<any>;
    loadRecindex(recindex: any): Promise<any>;
    replaceResources(doc: any): Promise<void>;
    loadText(section: any): Promise<any>;
    createDocument(section: any): Promise<Document>;
    loadSection(section: any): Promise<any>;
    resolveHref(href: any): {
        index: any;
        anchor: (doc: any) => any;
    };
    splitTOCHref(href: any): any[];
    getTOCFragment(doc: any, id: any): any;
    isExternal(uri: any): boolean;
    destroy(): void;
    #private;
}
export {};
