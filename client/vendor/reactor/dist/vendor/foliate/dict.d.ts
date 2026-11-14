export class DictdDict {
    loadDict(file: any, inflate: any): Promise<void>;
    lookup(query: any): Promise<any[]>;
    #private;
}
export class StarDict {
    loadIfo(file: any): Promise<void>;
    ifo: {
        [k: string]: any;
    } | undefined;
    loadDict(file: any, inflate: any): Promise<void>;
    loadIdx(file: any): Promise<void>;
    loadSyn(file: any): Promise<void> | undefined;
    lookup(query: any): Promise<any[]>;
    synonyms(query: any): Promise<any[]>;
    #private;
}
