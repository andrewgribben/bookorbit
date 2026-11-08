import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from '@bookorbit/types';

import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import type { ReadingServiceMatchRepository } from './reading-service-match.repository';
import { ReadingServicesController } from './reading-services.controller';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import type { ReadingServiceLibraryScopeService } from './reading-service-library-scope.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';

function makeUser(permissions: Permission[] = []): RequestUser {
  return { id: 1, isSuperuser: false, permissions } as RequestUser;
}

function makeController() {
  const registry = new ReadingServiceRegistry();
  const featuresService = {
    getFeatures: vi.fn().mockResolvedValue({}),
    setFeatures: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReadingServiceFeaturesService;
  const libraryScopeService = {
    getLibrarySummaries: vi.fn().mockResolvedValue([]),
    setLibrarySetting: vi.fn().mockResolvedValue({ libraryId: 1, enabled: true, features: {} }),
    resetLibrarySetting: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReadingServiceLibraryScopeService;
  const syncRunService = {
    startMigration: vi.fn(),
    getRun: vi.fn(),
    cancel: vi.fn(),
    resumeMigration: vi.fn(),
    getLatestMigrationSummary: vi.fn().mockResolvedValue({ state: 'never', runId: null, finishedAt: null }),
  } as unknown as ReadingServiceSyncRunService;
  const matchRepository = { findCandidates: vi.fn().mockResolvedValue([]) } as unknown as ReadingServiceMatchRepository;
  const controller = new ReadingServicesController(
    registry,
    featuresService,
    libraryScopeService,
    syncRunService,
    new PermissionService(),
    matchRepository,
  );
  return { controller, registry, featuresService, libraryScopeService, syncRunService, matchRepository };
}

describe('ReadingServicesController', () => {
  it('rejects an unknown provider with 400', async () => {
    const { controller } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);

    await expect(controller.updateFeatures(user, 'bogus', { features: {} })).rejects.toThrow(BadRequestException);
  });

  it('rejects a provider the user lacks permission for', async () => {
    const { controller, registry } = makeController();
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);

    await expect(controller.updateFeatures(user, 'hardcover', { features: {} })).rejects.toThrow(ForbiddenException);
  });

  it('updates features for a provider the user has permission for', async () => {
    const { controller, registry, featuresService } = makeController();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);

    await controller.updateFeatures(user, 'readwise', { features: { status: true } });

    expect(featuresService.setFeatures).toHaveBeenCalledWith(1, 'readwise', { status: true });
  });

  it('only lists providers the user has permission for', async () => {
    const { controller, registry } = makeController();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(false),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);

    const summaries = await controller.list(user);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.provider).toBe('readwise');
  });

  it('starts a migration for a permitted provider', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.startMigration as any).mockResolvedValue({ id: 1 });

    const result = await controller.startMigration(user, 'readwise');

    expect(syncRunService.startMigration).toHaveBeenCalledWith(1, 'readwise');
    expect(result).toEqual({ id: 1 });
  });

  it('returns a run for a provider the user has permission for', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'readwise' });

    const result = await controller.getRun(user, 1);

    expect(result).toEqual({ id: 1, provider: 'readwise' });
  });

  it('rejects getting a run that belongs to a provider the user lacks permission for', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'hardcover' });

    await expect(controller.getRun(user, 1)).rejects.toThrow(ForbiddenException);
    expect(syncRunService.cancel).not.toHaveBeenCalled();
  });

  it('rejects cancelling a run that belongs to a provider the user lacks permission for', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'hardcover' });

    await expect(controller.cancelRun(user, 1)).rejects.toThrow(ForbiddenException);
    expect(syncRunService.cancel).not.toHaveBeenCalled();
  });

  it('cancels a run for a provider the user has permission for', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'readwise' });
    (syncRunService.cancel as any).mockResolvedValue({ id: 1, provider: 'readwise', status: 'cancelled' });

    const result = await controller.cancelRun(user, 1);

    expect(syncRunService.cancel).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ id: 1, provider: 'readwise', status: 'cancelled' });
  });

  it('resumes a run for a provider the user has permission for', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'readwise' });
    (syncRunService.resumeMigration as any).mockResolvedValue({ id: 1, provider: 'readwise', status: 'running' });

    const result = await controller.resumeRun(user, 1);

    expect(syncRunService.resumeMigration).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ id: 1, provider: 'readwise', status: 'running' });
  });

  it('rejects resuming a run that belongs to a provider the user lacks permission for', async () => {
    const { controller, registry, syncRunService } = makeController();
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'hardcover' });

    await expect(controller.resumeRun(user, 1)).rejects.toThrow(ForbiddenException);
    expect(syncRunService.resumeMigration).not.toHaveBeenCalled();
  });

  it('lists readwise-only books for a permitted provider via the adapter', async () => {
    const { controller, registry } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    const listRemoteOnlyBooks = vi.fn().mockResolvedValue({
      items: [{ externalId: 'rw1', title: 'A', author: 'B', coverImageUrl: null, ownership: 'unknown', externalUrl: null }],
      next: null,
      total: 1,
    });
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      listRemoteOnlyBooks,
    });

    const result = await controller.listReadwiseOnlyBooks(user, 'readwise', '0', '50');

    expect(listRemoteOnlyBooks).toHaveBeenCalledWith(1, 0, 50);
    expect(result.total).toBe(1);
  });

  it('returns an empty page when the adapter has no readwise-only listing support', async () => {
    const { controller, registry } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });

    const result = await controller.listReadwiseOnlyBooks(user, 'readwise');

    expect(result).toEqual({ items: [], next: null, total: 0 });
  });

  it('rejects an unknown shelf with 400', async () => {
    const { controller, registry } = makeController();
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    const user = makeUser([Permission.HardcoverSync]);

    await expect(controller.getShelf(user, 'hardcover', 'bogus-shelf')).rejects.toThrow(BadRequestException);
  });

  it('rejects a shelf the registered adapter does not declare the capability for', async () => {
    const { controller, registry } = makeController();
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      getShelf: vi.fn(),
    });
    const user = makeUser([Permission.HardcoverSync]);

    await expect(controller.getShelf(user, 'hardcover', 'trending')).rejects.toThrow(NotFoundException);
  });

  it('reads a shelf from the adapter when the capability and getShelf are both present', async () => {
    const { controller, registry } = makeController();
    const getShelf = vi.fn().mockResolvedValue([{ externalId: '1' }]);
    registry.register({
      provider: 'hardcover',
      permission: Permission.HardcoverSync,
      capabilities: { trending_shelf: 'read' },
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      getShelf,
    });
    const user = makeUser([Permission.HardcoverSync]);

    const result = await controller.getShelf(user, 'hardcover', 'trending');

    expect(getShelf).toHaveBeenCalledWith(1, 'trending');
    expect(result).toEqual([{ externalId: '1' }]);
  });

  it('rejects an unregistered provider for a generic shelf with 400', async () => {
    const { controller } = makeController();
    const user = makeUser([Permission.ReadwiseSync, Permission.HardcoverSync]);

    await expect(controller.getShelf(user, 'private-service', 'trending')).rejects.toThrow(BadRequestException);
  });

  it('uses a private adapter declared permission instead of the fixed provider map', async () => {
    const { controller, registry } = makeController();
    const getShelf = vi.fn().mockResolvedValue([{ externalId: 'p1' }]);
    registry.register({
      provider: 'private-service' as never,
      permission: Permission.KoboSync,
      capabilities: { trending_shelf: 'read' },
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      getShelf,
    });

    const withoutPermission = makeUser([Permission.ReadwiseSync, Permission.HardcoverSync]);
    await expect(controller.getShelf(withoutPermission, 'private-service', 'trending')).rejects.toThrow(ForbiddenException);

    const withPermission = makeUser([Permission.KoboSync]);
    const result = await controller.getShelf(withPermission, 'private-service', 'trending');

    expect(getShelf).toHaveBeenCalledWith(1, 'trending');
    expect(result).toEqual([{ externalId: 'p1' }]);
  });

  it('resolves bookId server-side for an item an adapter left unmatched by isbn', async () => {
    const { controller, registry, matchRepository } = makeController();
    const getShelf = vi.fn().mockResolvedValue([
      {
        provider: 'private-service',
        externalId: 'ext1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        bookId: null,
        friend: null,
        isbn: '9780441013593',
      },
    ]);
    registry.register({
      provider: 'private-service' as never,
      permission: Permission.KoboSync,
      capabilities: { trending_shelf: 'read' },
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      getShelf,
    });
    (matchRepository.findCandidates as any).mockResolvedValue([
      { externalId: '42', isbn13: '9780441013593', isbn10: null, title: 'Dune', author: 'Frank Herbert' },
    ]);
    const user = makeUser([Permission.KoboSync]);

    const result = await controller.getShelf(user, 'private-service', 'trending');

    expect(matchRepository.findCandidates).toHaveBeenCalledWith(1, ['9780441013593'], ['dune']);
    expect(result).toEqual([
      { provider: 'private-service', externalId: 'ext1', title: 'Dune', authors: ['Frank Herbert'], bookId: 42, friend: null },
    ]);
  });

  it('strips isbn/asin hints from a response even when no match was found', async () => {
    const { controller, registry, matchRepository } = makeController();
    const getShelf = vi.fn().mockResolvedValue([
      {
        provider: 'private-service',
        externalId: 'ext1',
        title: 'Unknown Book',
        authors: ['Nobody'],
        bookId: null,
        friend: null,
        isbn: '0000000000000',
        asin: 'B000000000',
      },
    ]);
    registry.register({
      provider: 'private-service' as never,
      permission: Permission.KoboSync,
      capabilities: { trending_shelf: 'read' },
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      getShelf,
    });
    (matchRepository.findCandidates as any).mockResolvedValue([]);
    const user = makeUser([Permission.KoboSync]);

    const result = await controller.getShelf(user, 'private-service', 'trending');

    expect(result).toEqual([
      { provider: 'private-service', externalId: 'ext1', title: 'Unknown Book', authors: ['Nobody'], bookId: null, friend: null },
    ]);
  });

  it('leaves an already-matched item untouched and still strips its hints', async () => {
    const { controller, registry, matchRepository } = makeController();
    const getShelf = vi.fn().mockResolvedValue([
      {
        provider: 'private-service',
        externalId: 'ext1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        bookId: 7,
        friend: null,
        isbn: '9780441013593',
      },
    ]);
    registry.register({
      provider: 'private-service' as never,
      permission: Permission.KoboSync,
      capabilities: { trending_shelf: 'read' },
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
      getShelf,
    });
    const user = makeUser([Permission.KoboSync]);

    const result = await controller.getShelf(user, 'private-service', 'trending');

    expect(matchRepository.findCandidates).not.toHaveBeenCalled();
    expect(result).toEqual([{ provider: 'private-service', externalId: 'ext1', title: 'Dune', authors: ['Frank Herbert'], bookId: 7, friend: null }]);
  });

  describe('library scope endpoints', () => {
    it('updates a library setting through PUT and returns the stored effective values', async () => {
      const { controller, libraryScopeService } = makeController();
      const user = makeUser([Permission.ReadwiseSync]);
      vi.mocked(libraryScopeService.setLibrarySetting).mockResolvedValue({ libraryId: 2, enabled: false, features: {} });

      const result = await controller.updateLibrary(user, 'readwise', 2, { enabled: false });

      expect(libraryScopeService.setLibrarySetting).toHaveBeenCalledWith(user, 'readwise', 2, { enabled: false });
      expect(result).toEqual({ libraryId: 2, enabled: false, features: {} });
    });

    it('rejects a PUT for a provider the user lacks permission for', async () => {
      const { controller } = makeController();
      const user = makeUser([]);

      await expect(controller.updateLibrary(user, 'readwise', 2, { enabled: false })).rejects.toThrow(ForbiddenException);
    });

    it('resets a library setting through DELETE', async () => {
      const { controller, libraryScopeService } = makeController();
      const user = makeUser([Permission.HardcoverSync]);

      const result = await controller.resetLibrary(user, 'hardcover', 3);

      expect(libraryScopeService.resetLibrarySetting).toHaveBeenCalledWith(user, 'hardcover', 3);
      expect(result).toEqual({ libraryId: 3, enabled: true, features: {} });
    });

    it('includes the libraries array from the scope service in the provider summary', async () => {
      const { controller, libraryScopeService } = makeController();
      const user = makeUser([Permission.ReadwiseSync]);
      vi.mocked(libraryScopeService.getLibrarySummaries).mockResolvedValue([{ libraryId: 1, enabled: true, features: {} }]);

      const [summary] = await controller.list(user);

      expect(summary?.libraries).toEqual([{ libraryId: 1, enabled: true, features: {} }]);
    });
  });
});
