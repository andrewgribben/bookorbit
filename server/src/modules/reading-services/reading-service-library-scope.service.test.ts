import { describe, expect, it, vi } from 'vitest';

import type { LibraryService } from '../library/library.service';
import { ReadingServiceLibraryScopeService } from './reading-service-library-scope.service';
import type { ReadingServicesRepository } from './reading-services.repository';

function makeService(isSuperuser: boolean) {
  const repo = {
    isSuperuser: vi.fn().mockResolvedValue(isSuperuser),
    findLibrarySettings: vi.fn().mockResolvedValue([{ libraryId: 5, enabled: false, features: {} }]),
    setLibrarySetting: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReadingServicesRepository;
  // Superusers see every library without access rows; other users only see their access rows (none here).
  const libraryService = {
    findAccessibleLibraryIds: vi.fn((user: { isSuperuser: boolean }) => Promise.resolve(user.isSuperuser ? [1, 5] : [])),
  } as unknown as LibraryService;
  return { service: new ReadingServiceLibraryScopeService(repo, libraryService), repo };
}

describe('ReadingServiceLibraryScopeService.getEffectiveLibraryIdsForUserId', () => {
  it('gives a superuser with no library access rows every enabled library', async () => {
    await expect(makeService(true).service.getEffectiveLibraryIdsForUserId(1, 'hardcover', null)).resolves.toEqual([1]);
  });

  it('gives a regular user only the libraries they can access', async () => {
    await expect(makeService(false).service.getEffectiveLibraryIdsForUserId(2, 'hardcover', null)).resolves.toEqual([]);
  });
});

describe('ReadingServiceLibraryScopeService.setLibrarySetting series mode', () => {
  it('persists seriesMode for Readwise', async () => {
    const { service, repo } = makeService(true);
    const result = await service.setLibrarySetting({ id: 1, isSuperuser: true } as never, 'readwise', 1, { seriesMode: true });
    expect(result.seriesMode).toBe(true);
    expect(repo.setLibrarySetting).toHaveBeenCalledWith(1, 'readwise', 1, expect.objectContaining({ seriesMode: true }));
  });

  it('ignores seriesMode for a non-Readwise provider (owner decision: Readwise only)', async () => {
    const { service, repo } = makeService(true);
    const result = await service.setLibrarySetting({ id: 1, isSuperuser: true } as never, 'hardcover', 1, { seriesMode: true });
    expect(result.seriesMode).toBe(false);
    expect(repo.setLibrarySetting).toHaveBeenCalledWith(1, 'hardcover', 1, expect.objectContaining({ seriesMode: false }));
  });
});
