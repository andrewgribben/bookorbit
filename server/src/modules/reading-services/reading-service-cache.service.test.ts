import { ReadingServiceCacheService } from './reading-service-cache.service';
import type { ReadingServicesRepository } from './reading-services.repository';

describe('ReadingServiceCacheService', () => {
  function makeRepo() {
    return { findCache: vi.fn(), setCache: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServicesRepository;
  }

  it('returns null when nothing is cached', async () => {
    const repo = makeRepo();
    (repo.findCache as any).mockResolvedValue(undefined);
    const service = new ReadingServiceCacheService(repo);

    await expect(service.get(1, 'readwise', 'recap:2026')).resolves.toBeNull();
  });

  it('returns the payload while it has not expired', async () => {
    const repo = makeRepo();
    (repo.findCache as any).mockResolvedValue({ payload: { total: 5 }, expiresAt: new Date(Date.now() + 60_000) });
    const service = new ReadingServiceCacheService(repo);

    await expect(service.get(1, 'readwise', 'recap:2026')).resolves.toEqual({ total: 5 });
  });

  it('returns null once the cached row has expired', async () => {
    const repo = makeRepo();
    (repo.findCache as any).mockResolvedValue({ payload: { total: 5 }, expiresAt: new Date(Date.now() - 1) });
    const service = new ReadingServiceCacheService(repo);

    await expect(service.get(1, 'readwise', 'recap:2026')).resolves.toBeNull();
  });

  it('writes the payload with an expiry ttlMs in the future', async () => {
    const repo = makeRepo();
    const service = new ReadingServiceCacheService(repo);

    await service.set(1, 'readwise', 'recap:2026', { total: 5 }, 60_000);

    expect(repo.setCache).toHaveBeenCalledWith(1, 'readwise', 'recap:2026', { total: 5 }, expect.any(Date));
  });
});
