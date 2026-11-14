import type { SearchHit } from '../protocol/v1/events.js';
import type { FoliateView } from './foliate-types.js';
export declare const SEARCH_MAX_RESULTS = 200;
export interface SearchCallbacks {
    onResults(label: string, items: SearchHit[]): void;
    onProgress(progress: number): void;
    onDone(total: number, capped: boolean): void;
}
/** Holds the cancellation token across calls; one instance per ContentCore. */
export declare class SearchController {
    private token;
    clear(view: FoliateView | null | undefined): void;
    run(view: FoliateView | null | undefined, query: string, callbacks: SearchCallbacks): Promise<void>;
}
