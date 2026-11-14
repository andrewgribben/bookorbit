export class FixedLayout extends HTMLElement {
    static observedAttributes: string[];
    defaultViewport: any;
    spread: any;
    attributeChangedCallback(name: any, _: any, value: any): void;
    open(book: any): void;
    book: any;
    rtl: boolean | undefined;
    get index(): any;
    getSpreadOf(section: any): {
        index: number;
        side: string;
    } | undefined;
    goToSpread(index: any, side: any, reason: any): Promise<void>;
    select(target: any): Promise<void>;
    goTo(target: any): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    getContents(): {
        doc: Document | null;
        index: number | undefined;
    }[];
    destroy(): void;
    #private;
}
