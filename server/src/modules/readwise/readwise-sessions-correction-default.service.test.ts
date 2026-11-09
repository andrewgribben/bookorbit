import { describe, expect, it, vi } from 'vitest';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadwiseBooksClientService } from './readwise-books-client.service';
import { ReadwiseSessionsCorrectionService } from './readwise-sessions-correction.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { READWISE_SESSIONS_CORRECTION_ENABLED } from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';

/**
 * Separate from readwise-sessions-correction.service.test.ts, which mocks the module-level
 * constant to true to exercise the correction logic. This file asserts the real, unmocked
 * default: the job must stay off until the PATCH /sessions paused_seconds semantics are
 * confirmed with Readwise (see the constant's comment in readwise.constants.ts).
 */
describe('ReadwiseSessionsCorrectionService (default config)', () => {
  it('is disabled by default', () => {
    expect(READWISE_SESSIONS_CORRECTION_ENABLED).toBe(false);
  });

  it('does nothing when the correction job is disabled', async () => {
    const client = { updateSessions: vi.fn() } as unknown as ReadwiseBooksClientService;
    const sessionsRepo = { findLinkedSessionsForCorrection: vi.fn() } as unknown as ReadwiseSessionsLocalRepository;
    const readwiseRepo = {} as unknown as ReadwiseRepository;
    const cache = { get: vi.fn(), set: vi.fn() } as unknown as ReadingServiceCacheService;

    const service = new ReadwiseSessionsCorrectionService(client, sessionsRepo, readwiseRepo, cache);
    await service.correctUser(1, 'tok');

    expect(sessionsRepo.findLinkedSessionsForCorrection).not.toHaveBeenCalled();
    expect(client.updateSessions).not.toHaveBeenCalled();
  });
});
