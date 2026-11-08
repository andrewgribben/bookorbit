import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  READING_SERVICE_SHELVES,
  Permission,
  type ReadingServiceAvailableShelf,
  type ReadingServiceFeature,
  type ReadingServiceProvider,
  type ReadingServiceRemoteOnlyBooksPage,
  type ReadingServiceShelf,
  type ReadingServiceShelfItem,
  type ReadingServiceSummary,
  type SyncRunProgress,
} from '@bookorbit/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import { UpdateReadingServiceFeaturesDto } from './dto';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import type { ReadingServiceProviderAdapter } from './reading-service-provider';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';

// Fixed mapping for the two built-in providers, kept for backward compatibility. Anything else
// (a private, operator-supplied adapter) falls back to the permission the adapter itself
// declares (`ReadingServiceProviderAdapter.permission`), validated at load time by
// `ReadingServicePrivateAdapterLoaderService`.
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
  'owned-elsewhere': 'owned',
};

// There is no class-level permission guard here on purpose: a private adapter's declared
// permission can be any existing `Permission`, not just ReadwiseSync/HardcoverSync, so a static
// class-level allow-list would block it before `assertProviderAccess` ever runs. Every method
// below does its own permission check (directly or via `assertProviderAccess`); the global
// `JwtAuthGuard` still requires a logged-in user for all of them.
@Controller('reading-services')
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
      if (!this.permissionService.userHas(user, this.permissionFor(adapter))) continue;

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

  /** Every shelf a connected provider currently exposes, for the "Customize Dashboard" picker. */
  @Get('shelves/available')
  async listAvailableShelves(@CurrentUser() user: RequestUser): Promise<ReadingServiceAvailableShelf[]> {
    const available: ReadingServiceAvailableShelf[] = [];
    for (const adapter of this.registry.list()) {
      if (!adapter.getShelf) continue;
      if (!this.permissionService.userHas(user, this.permissionFor(adapter))) continue;

      const connected = await adapter.isConnected(user.id);
      for (const shelf of READING_SERVICE_SHELVES) {
        if (!adapter.capabilities[SHELF_FEATURES[shelf]]) continue;
        available.push({ provider: adapter.provider, shelf, connected });
      }
    }
    return available;
  }

  @Patch(':provider/features')
  async updateFeatures(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Body() dto: UpdateReadingServiceFeaturesDto,
  ): Promise<Partial<Record<string, boolean>>> {
    const typedProvider = this.assertProviderAccess(user, provider) as ReadingServiceProvider;
    await this.featuresService.setFeatures(user.id, typedProvider, dto.features);
    return this.featuresService.getFeatures(user.id, typedProvider);
  }

  @Post(':provider/migration/preview')
  async previewMigration(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ): Promise<{ matched: number; toCreate: number; readwiseOnly: number }> {
    const typedProvider = this.assertProviderAccess(user, provider) as ReadingServiceProvider;
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.previewMigration) return { matched: 0, toCreate: 0, readwiseOnly: 0 };
    return adapter.previewMigration(user.id);
  }

  @Post(':provider/migration')
  async startMigration(@CurrentUser() user: RequestUser, @Param('provider') provider: string): Promise<SyncRunProgress> {
    const typedProvider = this.assertProviderAccess(user, provider) as ReadingServiceProvider;
    return this.syncRunService.startMigration(user.id, typedProvider);
  }

  @Get(':provider/migration/readwise-only')
  async listReadwiseOnlyBooks(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Query('offset') offsetRaw?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<ReadingServiceRemoteOnlyBooksPage> {
    const typedProvider = this.assertProviderAccess(user, provider) as ReadingServiceProvider;
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

  /**
   * Generic social/discover/owned shelves, read-only, open to any registered provider
   * (built-in or private). Each item carries its own `provider` field so one client component
   * can render shelves from more than one reading service (see `docs/AGENT_HANDOFF.md` for the
   * adapter contract a private provider must implement).
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

  /** Built-in providers keep their fixed permission; anything else uses the adapter's own declared one. */
  private permissionFor(adapter: ReadingServiceProviderAdapter): Permission {
    return PROVIDER_PERMISSIONS[adapter.provider as ReadingServiceProvider] ?? adapter.permission;
  }

  private assertProviderAccess(user: RequestUser, provider: string): string {
    const adapter = this.registry.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unknown reading-service provider: ${provider}`);
    }
    const permission = this.permissionFor(adapter);
    if (!this.permissionService.userHas(user, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return provider;
  }
}
