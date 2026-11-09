import { createHash } from 'crypto';

/**
 * Content fingerprint stored on `reading_service_item_links.contentHash` for a pushed session,
 * mirroring the highlights ledger's `readwiseHighlightContentHash`. A koreader session can keep
 * growing after it is first pushed (a later page-stat upload extends the same local row), so
 * this lets the repair pass (`readwise-sessions-repair.service.ts`) detect "this local session
 * no longer matches what Readwise has" without re-fetching anything from Readwise. Not
 * security-sensitive: a dedupe/compare key only.
 */
export function readwiseSessionContentHash(session: { startedAt: Date; endedAt: Date; durationSeconds: number }): string {
  return createHash('sha256') // codeql[js/weak-cryptographic-algorithm] - non-security dedup key
    .update(`${session.startedAt.toISOString()}|${session.endedAt.toISOString()}|${session.durationSeconds}`)
    .digest('hex');
}
