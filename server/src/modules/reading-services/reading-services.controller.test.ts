import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Permission } from '@bookorbit/types';

import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import type { ReadingServiceMatchRepository } from './reading-service-match.repository';
import type { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';
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
  const credentials = {
    get: vi.fn().mockResolvedValue(null),
    isConnected: vi.fn().mockResolvedValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    markNeedsReconnect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReadingServicePrivateCredentialService;
  const controller = new ReadingServicesController(
    registry,
    featuresService,
    libraryScopeService,
    syncRunService,
    new PermissionService(),
    matchRepository,
    credentials,
  );
  return { controller, registry, featuresService, libraryScopeService, syncRunService, matchRepository, credentials };
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

    expect(matchRepository.findCandidates).toHaveBeenCalledWith(1, 'private-service', ['9780441013593'], ['dune']);
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
      const { controller, registry, libraryScopeService } = makeController();
      registry.register({
        provider: 'readwise',
        permission: Permission.ReadwiseSync,
        capabilities: {},
        isConnected: () => Promise.resolve(true),
        migratePage: () => Promise.resolve(null),
        pull: () => Promise.resolve(undefined),
      });
      const user = makeUser([Permission.ReadwiseSync]);
      vi.mocked(libraryScopeService.setLibrarySetting).mockResolvedValue({ libraryId: 2, enabled: false, features: {} });

      const result = await controller.updateLibrary(user, 'readwise', 2, { enabled: false });

      expect(libraryScopeService.setLibrarySetting).toHaveBeenCalledWith(user, 'readwise', 2, { enabled: false });
      expect(result).toEqual({ libraryId: 2, enabled: false, features: {} });
    });

    it('rejects a PUT for a provider the user lacks permission for', async () => {
      const { controller, registry } = makeController();
      registry.register({
        provider: 'readwise',
        permission: Permission.ReadwiseSync,
        capabilities: {},
        isConnected: () => Promise.resolve(true),
        migratePage: () => Promise.resolve(null),
        pull: () => Promise.resolve(undefined),
      });
      const user = makeUser([]);

      await expect(controller.updateLibrary(user, 'readwise', 2, { enabled: false })).rejects.toThrow(ForbiddenException);
    });

    it('resets a library setting through DELETE', async () => {
      const { controller, registry, libraryScopeService } = makeController();
      registry.register({
        provider: 'hardcover',
        permission: Permission.HardcoverSync,
        capabilities: {},
        isConnected: () => Promise.resolve(true),
        migratePage: () => Promise.resolve(null),
        pull: () => Promise.resolve(undefined),
      });
      const user = makeUser([Permission.HardcoverSync]);

      const result = await controller.resetLibrary(user, 'hardcover', 3);

      expect(libraryScopeService.resetLibrarySetting).toHaveBeenCalledWith(user, 'hardcover', 3);
      expect(result).toEqual({ libraryId: 3, enabled: true, features: {} });
    });

    it('includes the libraries array from the scope service in the provider summary', async () => {
      const { controller, registry, libraryScopeService } = makeController();
      registry.register({
        provider: 'readwise',
        permission: Permission.ReadwiseSync,
        capabilities: {},
        isConnected: () => Promise.resolve(true),
        migratePage: () => Promise.resolve(null),
        pull: () => Promise.resolve(undefined),
      });
      const user = makeUser([Permission.ReadwiseSync]);
      vi.mocked(libraryScopeService.getLibrarySummaries).mockResolvedValue([{ libraryId: 1, enabled: true, features: {} }]);

      const [summary] = await controller.list(user);

      expect(summary?.libraries).toEqual([{ libraryId: 1, enabled: true, features: {} }]);
    });
  });

  describe('private adapter connect flow', () => {
    function registerAdapter(registry: ReadingServiceRegistry, overrides: Record<string, unknown> = {}) {
      registry.register({
        provider: 'fixturewise' as never,
        permission: Permission.ReadwiseSync,
        capabilities: { friends_shelf: 'read' },
        displayName: 'Fixturewise',
        authMethods: [{ kind: 'device_code', label: 'Sign in' }],
        isConnected: () => Promise.resolve(false),
        migratePage: () => Promise.resolve(null),
        pull: () => Promise.resolve(undefined),
        ...overrides,
      });
    }

    it('includes displayName, authMethods and needsReconnect on the summary', async () => {
      const { controller, registry, credentials } = makeController();
      registerAdapter(registry);
      vi.mocked(credentials.get).mockResolvedValue({ credential: 'tok', accountLabel: 'user@example.test', needsReconnect: true });
      const user = makeUser([Permission.ReadwiseSync]);

      const [summary] = await controller.list(user);

      expect(summary?.displayName).toBe('Fixturewise');
      expect(summary?.authMethods).toEqual([{ kind: 'device_code', label: 'Sign in' }]);
      expect(summary?.needsReconnect).toBe(true);
    });

    it('rejects a token submission when the adapter has no validateCredential', async () => {
      const { controller, registry } = makeController();
      registerAdapter(registry);
      const user = makeUser([Permission.ReadwiseSync]);

      await expect(controller.connectWithToken(user, 'fixturewise', { credential: 'abc' })).rejects.toThrow(BadRequestException);
    });

    it('stores the credential after a successful token validation', async () => {
      const { controller, registry, credentials } = makeController();
      registerAdapter(registry, { validateCredential: vi.fn().mockResolvedValue({ ok: true, accountLabel: 'user@example.test' }) });
      const user = makeUser([Permission.ReadwiseSync]);

      const result = await controller.connectWithToken(user, 'fixturewise', { credential: 'abc' });

      expect(result).toEqual({ ok: true, accountLabel: 'user@example.test' });
      expect(credentials.save).toHaveBeenCalledWith(1, 'fixturewise', 'abc', 'user@example.test');
    });

    it('rejects an invalid token without storing anything', async () => {
      const { controller, registry, credentials } = makeController();
      registerAdapter(registry, { validateCredential: vi.fn().mockResolvedValue({ ok: false, reason: 'invalid' }) });
      const user = makeUser([Permission.ReadwiseSync]);

      await expect(controller.connectWithToken(user, 'fixturewise', { credential: 'bad' })).rejects.toThrow(BadRequestException);
      expect(credentials.save).not.toHaveBeenCalled();
    });

    it('starts and polls device-code auth through the adapter', async () => {
      const { controller, registry } = makeController();
      const startDeviceAuth = vi.fn().mockResolvedValue({ verificationUrl: 'https://x.test', userCode: 'ABCD', expiresAt: new Date().toISOString(), pollIntervalSeconds: 2 });
      const pollDeviceAuth = vi.fn().mockResolvedValue({ status: 'pending' });
      registerAdapter(registry, { startDeviceAuth, pollDeviceAuth });
      const user = makeUser([Permission.ReadwiseSync]);

      const started = await controller.startDeviceAuth(user, 'fixturewise');
      expect(started.userCode).toBe('ABCD');

      const polled = await controller.pollDeviceAuth(user, 'fixturewise');
      expect(polled.status).toBe('pending');
    });

    it('disconnects through the adapter and deletes the stored credential', async () => {
      const { controller, registry } = makeController();
      const disconnect = vi.fn().mockResolvedValue(undefined);
      registerAdapter(registry, { disconnect });
      const user = makeUser([Permission.ReadwiseSync]);

      const result = await controller.disconnect(user, 'fixturewise');

      expect(result).toEqual({ ok: true });
      expect(disconnect).toHaveBeenCalledWith(1);
    });

    it('stores the credential after a successful password sign-in, never the password itself', async () => {
      const { controller, registry, credentials } = makeController();
      const loginWithPassword = vi.fn().mockResolvedValue({ ok: true, credential: 'token-from-password', accountLabel: 'user@example.test' });
      registerAdapter(registry, { loginWithPassword });
      const user = makeUser([Permission.ReadwiseSync]);

      const result = await controller.connectWithPassword(user, 'fixturewise', { username: 'user@example.test', password: 'super-secret-password' });

      expect(result).toEqual({ ok: true, accountLabel: 'user@example.test' });
      expect(credentials.save).toHaveBeenCalledWith(1, 'fixturewise', 'token-from-password', 'user@example.test');
      // The response the client actually receives must never contain the password.
      expect(JSON.stringify(result)).not.toContain('super-secret-password');
    });

    it('returns the failure reason for a bad password sign-in without storing anything', async () => {
      const { controller, registry, credentials } = makeController();
      const loginWithPassword = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid' });
      registerAdapter(registry, { loginWithPassword });
      const user = makeUser([Permission.ReadwiseSync]);

      const result = await controller.connectWithPassword(user, 'fixturewise', { username: 'user@example.test', password: 'wrong' });

      expect(result).toEqual({ ok: false, reason: 'invalid', message: null });
      expect(credentials.save).not.toHaveBeenCalled();
    });

    it('surfaces mfa_required so the UI can prompt for a second factor', async () => {
      const { controller, registry } = makeController();
      registerAdapter(registry, { loginWithPassword: vi.fn().mockResolvedValue({ ok: false, reason: 'mfa_required' }) });
      const user = makeUser([Permission.ReadwiseSync]);

      const result = await controller.connectWithPassword(user, 'fixturewise', { username: 'user@example.test', password: 'wrong' });

      expect(result).toEqual({ ok: false, reason: 'mfa_required', message: null });
    });

    it('rejects a password submission when the adapter has no loginWithPassword', async () => {
      const { controller, registry } = makeController();
      registerAdapter(registry);
      const user = makeUser([Permission.ReadwiseSync]);

      await expect(controller.connectWithPassword(user, 'fixturewise', { username: 'user@example.test', password: 'x' })).rejects.toThrow(BadRequestException);
    });

    it('never logs the raw password, on success or on failure', async () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        const { controller, registry } = makeController();
        registerAdapter(registry, {
          loginWithPassword: vi.fn().mockImplementation(async () => ({ ok: false, reason: 'invalid' })),
        });
        const user = makeUser([Permission.ReadwiseSync]);

        await controller.connectWithPassword(user, 'fixturewise', { username: 'user@example.test', password: 'a-very-secret-value' });

        const allLoggedText = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls].map((args) => JSON.stringify(args)).join('\n');
        expect(allLoggedText).not.toContain('a-very-secret-value');
      } finally {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });
});
