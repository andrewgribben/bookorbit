import { HardcoverReadingServicesAdapterService } from './hardcover-reading-services-adapter.service';
import type { HardcoverSettingsService } from './hardcover-settings.service';
import type { HardcoverSocialService } from './hardcover-social.service';
import type { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceRegistry } from '../reading-services/reading-service-registry.service';

function makeDeps() {
  const registry = new ReadingServiceRegistry();
  const settingsService = { getTokenForUser: vi.fn() } as unknown as HardcoverSettingsService;
  const socialService = { getShelf: vi.fn() } as unknown as HardcoverSocialService;
  const cache = { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServiceCacheService;
  const adapter = new HardcoverReadingServicesAdapterService(registry, settingsService, socialService, cache);
  return { registry, settingsService, socialService, cache, adapter };
}

describe('HardcoverReadingServicesAdapterService', () => {
  it('registers itself with the registry on module init', () => {
    const { registry, adapter } = makeDeps();

    adapter.onModuleInit();

    expect(registry.get('hardcover')).toBe(adapter);
  });

  it('declares the social shelf capabilities without claiming owned or review', () => {
    const { adapter } = makeDeps();

    expect(adapter.capabilities).toMatchObject({
      status: 'both',
      rating: 'both',
      dates: 'both',
      friends_shelf: 'read',
      trending_shelf: 'read',
      recommendations_shelf: 'read',
    });
    expect(adapter.capabilities.owned).toBeUndefined();
    expect(adapter.capabilities.review).toBeUndefined();
  });

  it('is connected only when a token can be resolved', async () => {
    const { adapter, settingsService } = makeDeps();
    (settingsService.getTokenForUser as any).mockResolvedValue('tok');

    await expect(adapter.isConnected(1)).resolves.toBe(true);

    (settingsService.getTokenForUser as any).mockResolvedValue(null);
    await expect(adapter.isConnected(1)).resolves.toBe(false);
  });

  it('never migrates through this adapter, since the existing module owns that', async () => {
    const { adapter } = makeDeps();

    await expect(adapter.migratePage(1, {}, { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 })).resolves.toBeNull();
  });

  it('getShelf serves a cached shelf without calling the social service', async () => {
    const { adapter, cache, socialService } = makeDeps();
    (cache.get as any).mockResolvedValue([{ externalId: '1' }]);

    const items = await adapter.getShelf(1, 'trending');

    expect(items).toEqual([{ externalId: '1' }]);
    expect(socialService.getShelf).not.toHaveBeenCalled();
  });

  it('getShelf fetches and caches a shelf on a cache miss', async () => {
    const { adapter, cache, socialService, settingsService } = makeDeps();
    (cache.get as any).mockResolvedValue(null);
    (settingsService.getTokenForUser as any).mockResolvedValue('tok');
    (socialService.getShelf as any).mockResolvedValue([{ externalId: '2' }]);

    const items = await adapter.getShelf(1, 'trending');

    expect(items).toEqual([{ externalId: '2' }]);
    expect(socialService.getShelf).toHaveBeenCalledWith(1, 'tok', 'trending');
    expect(cache.set).toHaveBeenCalledWith(1, 'hardcover', 'shelf:trending', [{ externalId: '2' }], expect.any(Number));
  });

  it('getShelf returns empty when not connected and nothing is cached', async () => {
    const { adapter, cache, settingsService, socialService } = makeDeps();
    (cache.get as any).mockResolvedValue(null);
    (settingsService.getTokenForUser as any).mockResolvedValue(null);

    await expect(adapter.getShelf(1, 'trending')).resolves.toEqual([]);
    expect(socialService.getShelf).not.toHaveBeenCalled();
  });

  it('pull refreshes every shelf and swallows a single shelf failure', async () => {
    const { adapter, settingsService, socialService, cache } = makeDeps();
    (settingsService.getTokenForUser as any).mockResolvedValue('tok');
    (socialService.getShelf as any).mockImplementation(async (_userId: number, _token: string, shelf: string) => {
      if (shelf === 'trending') throw new Error('rate limited');
      return [{ externalId: shelf }];
    });

    await adapter.pull(1);

    expect(socialService.getShelf).toHaveBeenCalledTimes(4);
    expect(cache.set).toHaveBeenCalledTimes(3);
  });

  it('pull does nothing when the user is not connected', async () => {
    const { adapter, settingsService, socialService } = makeDeps();
    (settingsService.getTokenForUser as any).mockResolvedValue(null);

    await adapter.pull(1);

    expect(socialService.getShelf).not.toHaveBeenCalled();
  });
});
