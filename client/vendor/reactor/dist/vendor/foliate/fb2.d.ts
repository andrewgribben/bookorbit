export function makeFB2(blob: any): Promise<{
    metadata: {
        title: any;
        identifier: any;
        language: any;
        author: any[];
        translator: any[];
        contributor: any[];
        publisher: any;
        published: any;
        modified: any;
        description: any;
        subject: any[];
    };
    getCover(): Promise<Blob>;
    sections: any;
    toc: any;
    resolveHref(href: any): {
        index: any;
        anchor: (doc: any) => any;
    };
    splitTOCHref(href: any): any;
    getTOCFragment(doc: any, id: any): any;
    destroy(): void;
}>;
