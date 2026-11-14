export interface SearchResultItem {
    cfi: string;
    pre: string;
    match: string;
    post: string;
}
export type ResultRow = {
    kind: 'header';
    label: string;
} | {
    kind: 'item';
    item: SearchResultItem;
    groupLabel: string;
};
export declare class ResultsStore {
    private rows;
    private headerAt;
    reset(): void;
    addGroup(label: string, items: readonly SearchResultItem[]): void;
    get rowCount(): number;
    rowAt(index: number): ResultRow | undefined;
    get isEmpty(): boolean;
}
