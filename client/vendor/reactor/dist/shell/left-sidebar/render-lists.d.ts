import type { RelatedItem, StarredItem } from './types.js';
export declare function renderStarredList(panel: HTMLElement, items: StarredItem[], onActivate: (item: StarredItem) => void): void;
export declare function renderRelatedList(panel: HTMLElement, items: RelatedItem[], onActivate: (item: RelatedItem) => void): void;
