import { describe, expect, it, vi } from 'vitest';

import type { LibraryService } from '../library/library.service';
import { ReadingServiceLibraryScopeService } from './reading-service-library-scope.service';
import type { ReadingServicesRepository } from './reading-services.repository';

function makeService(isSuperuser: boolean) {
  const repo = {
    isSuperuser: vi.fn().mockResolvedValue(isSuperuser),
    findLibrarySettings: vi.fn().mockResolvedValue([{ libraryId: 5, enabled: false, features: {} }]),
  } as unknown as ReadingServicesRepository;
  // Superusers see every library without access rows; other users only see their access rows (none here).
  const libraryService = {
    findAccessibleLibraryIds: vi.fn((user: { isSuperuser: boolean }) => Promise.resolve(user.isSuperuser ? [1, 5] : [])),
  } as unknown as LibraryService;
  return new ReadingServiceLibraryScopeService(repo, libraryService);
}

describe('ReadingServiceLibraryScopeService.getEffectiveLibraryIdsForUserId', () => {
  it('gives a superuser with no library access rows every enabled library', async () => {
    await expect(makeService(true).getEffectiveLibraryIdsForUserId(1, 'hardcover', null)).resolves.toEqual([1]);
  });

  it('gives a regular user only the libraries they can access', async () => {
    await expect(makeService(false).getEffectiveLibraryIdsForUserId(2, 'hardcover', null)).resolves.toEqual([]);
  });
});
