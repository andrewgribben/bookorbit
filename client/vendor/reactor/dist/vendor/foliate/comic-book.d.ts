export function makeComicBook({ entries, loadBlob, getSize }: {
    entries: any;
    loadBlob: any;
    getSize: any;
}, file: any): {
    getCover(): any;
    metadata: {
        title: any;
    };
    sections: any;
    toc: any;
    rendition: {
        layout: string;
    };
    resolveHref(href: any): {
        index: any;
    };
    splitTOCHref(href: any): any[];
    getTOCFragment(doc: any): any;
    destroy(): void;
};
