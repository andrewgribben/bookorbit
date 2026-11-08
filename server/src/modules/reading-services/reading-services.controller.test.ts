import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Permission } from '@bookorbit/types';

import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import { ReadingServicesController } from './reading-services.controller';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
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
  const syncRunService = {
    startMigration: vi.fn(),
    getRun: vi.fn(),
    cancel: vi.fn(),
    resumeMigration: vi.fn(),
    getLatestMigrationSummary: vi.fn().mockResolvedValue({ state: 'never', runId: null, finishedAt: null }),
  } as unknown as ReadingServiceSyncRunService;
  const controller = new ReadingServicesController(registry, featuresService, syncRunService, new PermissionService());
  return { controller, registry, featuresService, syncRunService };
}

describe('ReadingServicesController', () => {
  it('rejects an unknown provider with 400', async () => {
    const { controller } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);

    await expect(controller.updateFeatures(user, 'bogus', { features: {} })).rejects.toThrow(BadRequestException);
  });

  it('rejects a provider the user lacks permission for', async () => {
    const { controller } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);

    await expect(controller.updateFeatures(user, 'hardcover', { features: {} })).rejects.toThrow(ForbiddenException);
  });

  it('updates features for a provider the user has permission for', async () => {
    const { controller, featuresService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);

    await controller.updateFeatures(user, 'readwise', { features: { status: true } });

    expect(featuresService.setFeatures).toHaveBeenCalledWith(1, 'readwise', { status: true });
  });

  it('only lists providers the user has permission for', async () => {
    const { controller, registry } = makeController();
    registry.register({
      provider: 'readwise',
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });
    registry.register({
      provider: 'hardcover',
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
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.startMigration as any).mockResolvedValue({ id: 1 });

    const result = await controller.startMigration(user, 'readwise');

    expect(syncRunService.startMigration).toHaveBeenCalledWith(1, 'readwise');
    expect(result).toEqual({ id: 1 });
  });

  it('returns a run for a provider the user has permission for', async () => {
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'readwise' });

    const result = await controller.getRun(user, 1);

    expect(result).toEqual({ id: 1, provider: 'readwise' });
  });

  it('rejects getting a run that belongs to a provider the user lacks permission for', async () => {
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'hardcover' });

    await expect(controller.getRun(user, 1)).rejects.toThrow(ForbiddenException);
    expect(syncRunService.cancel).not.toHaveBeenCalled();
  });

  it('rejects cancelling a run that belongs to a provider the user lacks permission for', async () => {
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'hardcover' });

    await expect(controller.cancelRun(user, 1)).rejects.toThrow(ForbiddenException);
    expect(syncRunService.cancel).not.toHaveBeenCalled();
  });

  it('cancels a run for a provider the user has permission for', async () => {
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'readwise' });
    (syncRunService.cancel as any).mockResolvedValue({ id: 1, provider: 'readwise', status: 'cancelled' });

    const result = await controller.cancelRun(user, 1);

    expect(syncRunService.cancel).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ id: 1, provider: 'readwise', status: 'cancelled' });
  });

  it('resumes a run for a provider the user has permission for', async () => {
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'readwise' });
    (syncRunService.resumeMigration as any).mockResolvedValue({ id: 1, provider: 'readwise', status: 'running' });

    const result = await controller.resumeRun(user, 1);

    expect(syncRunService.resumeMigration).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ id: 1, provider: 'readwise', status: 'running' });
  });

  it('rejects resuming a run that belongs to a provider the user lacks permission for', async () => {
    const { controller, syncRunService } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    (syncRunService.getRun as any).mockResolvedValue({ id: 1, provider: 'hardcover' });

    await expect(controller.resumeRun(user, 1)).rejects.toThrow(ForbiddenException);
    expect(syncRunService.resumeMigration).not.toHaveBeenCalled();
  });

  it('lists readwise-only books for a permitted provider via the adapter', async () => {
    const { controller, registry } = makeController();
    const user = makeUser([Permission.ReadwiseSync]);
    const listRemoteOnlyBooks = vi.fn().mockResolvedValue({ items: [{ externalId: 'rw1', title: 'A', author: 'B', coverImageUrl: null, ownership: 'unknown', externalUrl: null }], next: null, total: 1 });
    registry.register({
      provider: 'readwise',
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
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => Promise.resolve(null),
      pull: () => Promise.resolve(undefined),
    });

    const result = await controller.listReadwiseOnlyBooks(user, 'readwise');

    expect(result).toEqual({ items: [], next: null, total: 0 });
  });
});
