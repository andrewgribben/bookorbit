export function search(strs: any, query: any, options: any): Generator<{
    range: {
        startIndex: any;
        startOffset: number;
        endIndex: number;
        endOffset: number;
    };
    excerpt: {
        pre: string;
        match: any;
        post: string;
    };
}, void, unknown>;
export function searchMatcher(textWalker: any, opts: any): (doc: any, query: any) => Generator<any, void, unknown>;
