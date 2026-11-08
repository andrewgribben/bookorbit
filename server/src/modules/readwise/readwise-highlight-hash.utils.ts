import { createHash } from 'crypto';

/**
 * Content fingerprint used by the S5 highlights ledger (`reading_service_item_links.contentHash`)
 * to detect a local edit worth pushing, or a remote edit worth pulling, without a second
 * `updated` timestamp on either side. Not security-sensitive: a dedup/compare key only.
 */
export function readwiseHighlightContentHash(text: string, note: string | null): string {
  return createHash('sha256') // codeql[js/weak-cryptographic-algorithm] - non-security dedup key
    .update(`${text}\u0000${note ?? ''}`)
    .digest('hex');
}
