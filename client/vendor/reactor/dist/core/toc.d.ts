import type { TocItem } from '../protocol/v1/events.js';
import type { FoliateTocItem } from './foliate-types.js';
export declare function serializeToc(items: FoliateTocItem[] | null | undefined): TocItem[];
