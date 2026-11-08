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
});
