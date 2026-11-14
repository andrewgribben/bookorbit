declare class ut extends ct {
    constructor(e: any);
    readUint8Array(e: any, t: any): Promise<Uint8Array<any>>;
}
declare class dt extends lt {
    constructor(e: any);
    blob: Promise<Blob>;
    getData(): Promise<Blob>;
}
declare class ft extends dt {
    getData(): Promise<any>;
}
declare class Ht {
    constructor(e: any, t?: {});
    getEntriesGenerator(e?: {}): AsyncGenerator<Mt, boolean, unknown>;
    prependedData: any;
    comment: any;
    appendedData: any;
    getEntries(e?: {}): Promise<Mt[]>;
    close(): Promise<void>;
}
declare function F(e: any): void;
declare class ct extends lt {
    get readable(): ReadableStream<any>;
}
declare class lt {
    size: number;
    init(): void;
    initialized: boolean | undefined;
}
declare class Mt {
    constructor(e: any);
}
export { ut as BlobReader, dt as BlobWriter, ft as TextWriter, Ht as ZipReader, F as configure };
