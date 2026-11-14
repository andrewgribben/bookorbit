export const isCFI: RegExp;
export function joinIndir(...xs: any[]): string;
export function parse(cfi: any): any;
export function collapse(x: any, toEnd: any): any;
export function compare(a: any, b: any): any;
export function fromRange(range: any, filter: any): any;
export function toRange(doc: any, parts: any, filter: any): any;
export function fromElements(elements: any): any[];
export function toElement(doc: any, parts: any): any;
export namespace fake {
    function fromIndex(index: any): any;
    function toIndex(parts: any): number;
}
export function fromCalibrePos(pos: any): any;
export function fromCalibreHighlight({ spine_index, start_cfi, end_cfi }: {
    spine_index: any;
    start_cfi: any;
    end_cfi: any;
}): any;
