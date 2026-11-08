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
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import {
  READING_SERVICE_SHELVES,
  Permission,
  type ReadingServiceAvailableShelf,
  type ReadingServiceDeviceAuthPollResult,
  type ReadingServiceDeviceAuthStart,
  type ReadingServiceFeature,
  type ReadingServicePasswordLoginResult,
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
import { buildRemoteIndex, isbn10ToIsbn13, matchBook } from './book-matcher';
import { ConnectPasswordDto, ConnectTokenDto, UpdateReadingServiceFeaturesDto, UpdateReadingServiceLibraryDto } from './dto';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import { ReadingServiceLibraryScopeService } from './reading-service-library-scope.service';
import { ReadingServiceMatchRepository } from './reading-service-match.repository';
import { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';
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
    private readonly libraryScopeService: ReadingServiceLibraryScopeService,
    private readonly syncRunService: ReadingServiceSyncRunService,
    private readonly permissionService: PermissionService,
    private readonly matchRepository: ReadingServiceMatchRepository,
    private readonly credentials: ReadingServicePrivateCredentialService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser): Promise<ReadingServiceSummary[]> {
    const summaries: ReadingServiceSummary[] = [];
    for (const adapter of this.registry.list()) {
      if (!this.permissionService.userHas(user, this.permissionFor(adapter))) continue;

      const [connected, features, migration, libraries] = await Promise.all([
        adapter.isConnected(user.id),
        this.featuresService.getFeatures(user.id, adapter.provider),
        this.syncRunService.getLatestMigrationSummary(user.id, adapter.provider),
        this.libraryScopeService.getLibrarySummaries(user, adapter.provider as ReadingServiceProvider),
      ]);

      const credential = adapter.authMethods ? await this.credentials.get(user.id, adapter.provider) : null;

      summaries.push({
        provider: adapter.provider,
        connected,
        capabilities: adapter.capabilities,
        features,
        migration,
        lastPullAt: null,
        disabledReason: null,
        libraries,
        displayName: adapter.displayName,
        description: adapter.description ?? null,
        iconUrl: adapter.iconUrl ?? null,
        authMethods: adapter.authMethods,
        needsReconnect: credential?.needsReconnect ?? false,
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

  /** Submits a `token`-method credential, validates it against the adapter, then stores it encrypted. */
  @Post(':provider/auth/token')
  async connectWithToken(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Body() dto: ConnectTokenDto,
  ): Promise<{ ok: boolean; accountLabel: string | null }> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.validateCredential) {
      throw new BadRequestException(`${typedProvider} does not support a token sign-in`);
    }

    const result = await adapter.validateCredential(user.id, dto.credential);
    if (!result.ok) {
      throw new BadRequestException(`Could not validate the ${typedProvider} token: ${result.reason ?? 'invalid'}`);
    }

    await this.credentials.save(user.id, typedProvider, dto.credential, result.accountLabel ?? null);
    return { ok: true, accountLabel: result.accountLabel ?? null };
  }

  /**
   * Submits a `password`-method sign-in. The password is read once off this request's body,
   * handed straight to the adapter, and discarded; only the credential the adapter returns is
   * ever stored. Rate-limited per user (owner rule: 5 attempts per 15 minutes) since this is a
   * credential-guessing surface, unlike the token/device-code routes.
   */
  @Post(':provider/auth/password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  async connectWithPassword(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Body() dto: ConnectPasswordDto,
  ): Promise<ReadingServicePasswordLoginResult> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.loginWithPassword) {
      throw new BadRequestException(`${typedProvider} does not support a password sign-in`);
    }

    const result = await adapter.loginWithPassword(user.id, dto.username, dto.password);
    if (!result.ok) {
      return { ok: false, reason: result.reason, message: result.message ?? null };
    }

    await this.credentials.save(user.id, typedProvider, result.credential, result.accountLabel ?? null);
    return { ok: true, accountLabel: result.accountLabel ?? null };
  }

  /** Starts a `device_code`-method sign-in. The handle never reaches the response. */
  @Post(':provider/auth/device/start')
  async startDeviceAuth(@CurrentUser() user: RequestUser, @Param('provider') provider: string): Promise<ReadingServiceDeviceAuthStart> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.startDeviceAuth) {
      throw new BadRequestException(`${typedProvider} does not support device-code sign-in`);
    }
    return adapter.startDeviceAuth(user.id);
  }

  /** Polls the sign-in started by `startDeviceAuth`. Approval stores the resulting credential server-side. */
  @Post(':provider/auth/device/poll')
  async pollDeviceAuth(@CurrentUser() user: RequestUser, @Param('provider') provider: string): Promise<ReadingServiceDeviceAuthPollResult> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.pollDeviceAuth) {
      throw new BadRequestException(`${typedProvider} does not support device-code sign-in`);
    }
    return adapter.pollDeviceAuth(user.id);
  }

  /** Deletes the stored credential for this provider (private adapters; built-ins have their own disconnect). */
  @Delete(':provider/auth')
  async disconnect(@CurrentUser() user: RequestUser, @Param('provider') provider: string): Promise<{ ok: true }> {
    const typedProvider = this.assertProviderAccess(user, provider);
    const adapter = this.registry.get(typedProvider);
    if (!adapter?.disconnect) {
      throw new BadRequestException(`${typedProvider} does not support disconnecting through this endpoint`);
    }
    await adapter.disconnect(user.id);
    return { ok: true };
  }

  /**
   * Per-library sync settings for this provider (owner decision: scoping is per library AND per
   * feature). Both body fields are optional. Returns the full effective setting after the
   * update (inherited defaults filled in).
   */
  @Put(':provider/libraries/:libraryId')
  async updateLibrary(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Param('libraryId', ParseIntPipe) libraryId: number,
    @Body() dto: UpdateReadingServiceLibraryDto,
  ): Promise<{ libraryId: number; enabled: boolean; features: Partial<Record<string, boolean>> }> {
    const typedProvider = this.assertProviderAccess(user, provider) as ReadingServiceProvider;
    return this.libraryScopeService.setLibrarySetting(user, typedProvider, libraryId, dto);
  }

  /** Resets a library back to "inherit" (library enabled, every feature follows the provider toggle). */
  @Delete(':provider/libraries/:libraryId')
  async resetLibrary(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Param('libraryId', ParseIntPipe) libraryId: number,
  ): Promise<{ libraryId: number; enabled: boolean; features: Partial<Record<string, boolean>> }> {
    const typedProvider = this.assertProviderAccess(user, provider) as ReadingServiceProvider;
    await this.libraryScopeService.resetLibrarySetting(user, typedProvider, libraryId);
    return { libraryId, enabled: true, features: {} };
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

    const items = await adapter.getShelf(user.id, typedShelf);
    return this.resolveUnmatchedBookIds(user.id, typedProvider as ReadingServiceProvider, items);
  }

  /**
   * Server-side fallback match (owner decision 2): an adapter - typically a private one with no
   * local database access - can leave `bookId: null` on a shelf item and pass `isbn`/`title`
   * +`authors` hints instead. This resolves those against the current user's accessible library
   * with the shared `ReadingServiceMatchRepository`/`book-matcher`, the same matcher every
   * built-in provider's own shelf service already uses, then strips `isbn`/`asin` from every
   * item before the response leaves the server - a client never needs either field (see
   * `ReadingServiceShelfItem`'s doc comment in @bookorbit/types).
   */
  private async resolveUnmatchedBookIds(
    userId: number,
    provider: ReadingServiceProvider,
    items: ReadingServiceShelfItem[],
  ): Promise<ReadingServiceShelfItem[]> {
    const unmatched = items.filter((item) => item.bookId == null && (item.isbn || (item.title && item.authors.length > 0)));

    if (unmatched.length === 0) return items.map((item) => this.stripMatchHints(item));

    const isbn13s = new Set<string>();
    const titlesLower = new Set<string>();
    for (const item of unmatched) {
      const isbn13 = this.toIsbn13(item.isbn);
      if (isbn13) isbn13s.add(isbn13);
      if (item.title) titlesLower.add(item.title.toLowerCase());
    }

    const candidates = await this.matchRepository.findCandidates(userId, provider, [...isbn13s], [...titlesLower]);
    if (candidates.length === 0) return items.map((item) => this.stripMatchHints(item));

    const index = buildRemoteIndex(candidates);
    return items.map((item) => {
      if (item.bookId != null) return this.stripMatchHints(item);
      const isbn13 = this.toIsbn13(item.isbn);
      const match = matchBook({ isbn13, isbn10: isbn13 ? null : (item.isbn ?? null), title: item.title, author: item.authors[0] ?? null }, index);
      const bookId = match ? Number(match.externalId) : null;
      return this.stripMatchHints({ ...item, bookId });
    });
  }

  /** Normalizes an adapter-supplied ISBN hint of either length to ISBN-13, or null when it isn't one. */
  private toIsbn13(rawIsbn: string | null | undefined): string | null {
    if (!rawIsbn) return null;
    const digits = rawIsbn.replace(/[^0-9Xx]/g, '');
    if (digits.length === 13) return digits;
    if (digits.length === 10) return isbn10ToIsbn13(digits);
    return null;
  }

  private stripMatchHints(item: ReadingServiceShelfItem): ReadingServiceShelfItem {
    if (item.isbn === undefined && item.asin === undefined) return item;
    const stripped: ReadingServiceShelfItem = { ...item };
    delete stripped.isbn;
    delete stripped.asin;
    return stripped;
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
