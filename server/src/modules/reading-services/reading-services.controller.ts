import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';

import {
  READING_SERVICE_PROVIDERS,
  READING_SERVICE_SHELVES,
  Permission,
  type ReadingServiceFeature,
  type ReadingServiceProvider,
  type ReadingServiceShelf,
  type ReadingServiceShelfItem,
  type ReadingServiceSummary,
  type SyncRunProgress,
} from '@bookorbit/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-any-permission.decorator';
import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import { UpdateReadingServiceFeaturesDto } from './dto';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';

const PROVIDER_PERMISSIONS: Record<ReadingServiceProvider, Permission> = {
  readwise: Permission.ReadwiseSync,
  hardcover: Permission.HardcoverSync,
};

/** The capability a shelf needs on the provider's `capabilities` map before it can be read. */
const SHELF_FEATURES: Record<ReadingServiceShelf, ReadingServiceFeature> = {
  'friends-reading': 'friends_shelf',
  'friends-finished': 'friends_shelf',
  trending: 'trending_shelf',
  recommendations: 'recommendations_shelf',
};

@Controller('reading-services')
@RequireAnyPermission(Permission.ReadwiseSync, Permission.HardcoverSync)
export class ReadingServicesController {
  constructor(
    private readonly registry: ReadingServiceRegistry,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly syncRunService: ReadingServiceSyncRunService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser): Promise<ReadingServiceSummary[]> {
    const summaries: ReadingServiceSummary[] = [];
    for (const adapter of this.registry.list()) {
      if (!this.permissionService.userHas(user, PROVIDER_PERMISSIONS[adapter.provider])) continue;

      const [connected, features, migration] = await Promise.all([
        adapter.isConnected(user.id),
        this.featuresService.getFeatures(user.id, adapter.provider),
        this.syncRunService.getLatestMigrationSummary(user.id, adapter.provider),
      ]);

      summaries.push({
        provider: adapter.provider,
        connected,
        capabilities: adapter.capabilities,
        features,
        migration,
        lastPullAt: null,
        disabledReason: null,
      });
    }
    return summaries;
  }

  @Patch(':provider/features')
  async updateFeatures(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Body() dto: UpdateReadingServiceFeaturesDto,
  ): Promise<Partial<Record<string, boolean>>> {
    const typedProvider = this.assertProviderAccess(user, provider);
    await this.featuresService.setFeatures(user.id, typedProvider, dto.features);
    return this.featuresService.getFeatures(user.id, typedProvider);
  }

  @Post(':provider/migration/preview')
  async previewMigration(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ): Promise<{ matched: number; toCreate: number; readwiseOnly: number }> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.previewMigration) return { matched: 0, toCreate: 0, readwiseOnly: 0 };
    return adapter.previewMigration(user.id);
  }

  @Post(':provider/migration')
  async startMigration(@CurrentUser() user: RequestUser, @Param('provider') provider: string): Promise<SyncRunProgress> {
    const typedProvider = this.assertProviderAccess(user, provider);
    return this.syncRunService.startMigration(user.id, typedProvider);
  }

  @Get('runs/:id')
  async getRun(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number): Promise<SyncRunProgress> {
    const progress = await this.syncRunService.getRun(id, user.id);
    this.assertProviderAccess(user, progress.provider);
    return progress;
  }

  @Delete('runs/:id')
  async cancelRun(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number): Promise<SyncRunProgress> {
    const progress = await this.syncRunService.getRun(id, user.id);
    this.assertProviderAccess(user, progress.provider);
    return this.syncRunService.cancel(id, user.id);
  }

  /**
   * Generic social/discover shelves, read-only. Coordinate shape changes with the widgets agent:
   * each item carries its own `provider` field so one component can render shelves from more than
   * one reading service (see `docs/AGENT_HANDOFF.md`).
   */
  @Get(':provider/shelves/:shelf')
  async getShelf(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Param('shelf') shelf: string,
  ): Promise<ReadingServiceShelfItem[]> {
    const typedProvider = this.assertProviderAccess(user, provider);
    if (!READING_SERVICE_SHELVES.includes(shelf as ReadingServiceShelf)) {
      throw new BadRequestException(`Unknown reading-service shelf: ${shelf}`);
    }
    const typedShelf = shelf as ReadingServiceShelf;

    const adapter = this.registry.get(typedProvider);
    const requiredFeature = SHELF_FEATURES[typedShelf];
    if (!adapter?.getShelf || !adapter.capabilities[requiredFeature]) {
      throw new NotFoundException(`${typedProvider} does not support the "${typedShelf}" shelf`);
    }

    return adapter.getShelf(user.id, typedShelf);
  }

  private assertProviderAccess(user: RequestUser, provider: string): ReadingServiceProvider {
    if (!READING_SERVICE_PROVIDERS.includes(provider as ReadingServiceProvider)) {
      throw new BadRequestException(`Unknown reading-service provider: ${provider}`);
    }
    const typedProvider = provider as ReadingServiceProvider;
    if (!this.permissionService.userHas(user, PROVIDER_PERMISSIONS[typedProvider])) {
      throw new ForbiddenException(`Missing permission: ${PROVIDER_PERMISSIONS[typedProvider]}`);
    }
    return typedProvider;
  }
}
