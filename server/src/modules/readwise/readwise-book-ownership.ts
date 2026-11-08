/**
 * User decision D1 (2026-11-08): Readwise has no "owned" flag. Approximate ownership from
 * `creation_origin`. Any origin we don't recognise is explicitly "unknown", never silently
 * assumed to be owned or not: we must not claim ownership proof we don't have.
 */
export type ReadwiseOwnershipClassification = 'owned' | 'not_owned' | 'unknown';

const OWNED_CREATION_ORIGINS = new Set(['kindle', 'audible', 'bookstore_ebook', 'uploaded_ebook', 'physical']);
const NOT_OWNED_CREATION_ORIGINS = new Set(['goodreads', 'storygraph', 'api']);

export function classifyReadwiseOwnership(creationOrigin: string | null | undefined): ReadwiseOwnershipClassification {
  if (!creationOrigin) return 'unknown';
  if (OWNED_CREATION_ORIGINS.has(creationOrigin)) return 'owned';
  if (NOT_OWNED_CREATION_ORIGINS.has(creationOrigin)) return 'not_owned';
  return 'unknown';
}
