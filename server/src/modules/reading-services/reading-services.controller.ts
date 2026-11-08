import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';

import {
  READING_SERVICE_PROVIDERS,
  Permission,
  type ReadingServiceProvider,
  type ReadingServiceRemoteOnlyBooksPage,
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

  @Get(':provider/migration/readwise-only')
  async listReadwiseOnlyBooks(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Query('offset') offsetRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<ReadingServiceRemoteOnlyBooksPage> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    const offset = Math.max(0, Number.parseInt(offsetRaw ?? '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw ?? '50', 10) || 50));
    if (!adapter?.listRemoteOnlyBooks) return { items: [], next: null, total: 0 };
    return adapter.listRemoteOnlyBooks(user.id, offset, limit);
  }

  @Post('runs/:id/resume')
  async resumeRun(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number): Promise<SyncRunProgress> {
    const progress = await this.syncRunService.getRun(id, user.id);
    this.assertProviderAccess(user, progress.provider);
    return this.syncRunService.resumeMigration(id, user.id);
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
