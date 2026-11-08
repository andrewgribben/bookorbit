import type { ReadStatus } from '@bookorbit/types';

import type { ReadwiseBookStatus } from './readwise-books-client.service';

/**
 * Section 4.1 of the reading-services plan. `null` means "do not push" (an unread book is never
 * added to Readwise).
 */
export function mapBookOrbitStatusToReadwise(status: ReadStatus): ReadwiseBookStatus | null {
  switch (status) {
    case 'unread':
      return null;
    case 'want_to_read':
      return 'want_to_read';
    case 'reading':
    case 'rereading':
    case 'on_hold':
      return 'currently_reading';
    case 'read':
    case 'skimmed':
      return 'finished';
    case 'abandoned':
      return 'did_not_finish';
    default:
      return null;
  }
}

/**
 * Pull direction (used from stage S3 onward). `currentLocal` lets `currently_reading` and
 * `finished` keep a local `rereading`/`on_hold` or `skimmed` status instead of overwriting it,
 * and `unsorted`/`deleted` are mapped to "no change" by returning null.
 */
export function mapReadwiseStatusToBookOrbit(status: ReadwiseBookStatus, currentLocal: ReadStatus | null): ReadStatus | null {
  switch (status) {
    case 'want_to_read':
      return 'want_to_read';
    case 'currently_reading':
      return currentLocal === 'rereading' || currentLocal === 'on_hold' ? currentLocal : 'reading';
    case 'finished':
      return currentLocal === 'skimmed' ? 'skimmed' : 'read';
    case 'did_not_finish':
      return 'abandoned';
    case 'unsorted':
    case 'deleted':
    default:
      return null;
  }
}
