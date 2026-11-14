export class TOCProgress {
    init({ toc, ids, splitHref, getFragment }: {
        toc: any;
        ids: any;
        splitHref: any;
        getFragment: any;
    }): Promise<void>;
    ids: any;
    map: Map<any, any> | undefined;
    getFragment: any;
    getProgress(index: any, range: any): any;
}
export class SectionProgress {
    constructor(sections: any, sizePerLoc: any, sizePerTimeUnit: any);
    sizes: any;
    sizePerLoc: any;
    sizePerTimeUnit: any;
    sizeTotal: any;
    sectionFractions: number[];
    getProgress(index: any, fractionInSection: any, pageFraction?: number): {
        fraction: number;
        section: {
            current: any;
            total: any;
        };
        location: {
            current: number;
            next: number;
            total: number;
        };
        time: {
            section: number;
            total: number;
        };
    };
    getSection(fraction: any): number[];
    #private;
}
