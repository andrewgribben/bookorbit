import { type ReaderSettings } from './settings.js';
export interface ReaderOpenMeta {
    format: string | null;
    cfi: string | null;
    fraction: number | null;
    settings: ReaderSettings | null;
    previousCfi: string | null;
}
export declare function isReaderOpenMeta(v: unknown): v is ReaderOpenMeta;
