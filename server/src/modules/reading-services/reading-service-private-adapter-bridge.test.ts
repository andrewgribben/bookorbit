import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivateAdapterBridge, type PrivateAdapterV2Module } from './reading-service-private-adapter-bridge';
import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';

function makeModule(overrides: Partial<PrivateAdapterV2Module> = {}): PrivateAdapterV2Module {
  return {
    provider: 'fixturewise',
    permission: 'readwise_sync',
    displayName: 'Fixturewise Friends',
    description: 'Synthetic test adapter',
    iconUrl: '<svg></svg>',
    capabilities: { friends_shelf: 'read' },
    auth: { methods: [{ kind: 'device_code', label: 'Sign in' }] },
    getShelf: vi.fn().mockResolvedValue({ items: [] }),
    ...overrides,
  };
}

describe('PrivateAdapterBridge', () => {
  let credentials: ReadingServicePrivateCredentialService;
  let cache: ReadingServiceCacheService;

  beforeEach(() => {
    credentials = {
      get: vi.fn(),
      isConnected: vi.fn(),
      save: vi.fn(),
      markNeedsReconnect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as ReadingServicePrivateCredentialService;
    cache = { get: vi.fn(), set: vi.fn() } as unknown as ReadingServiceCacheService;
  });

  it('exposes identity fields and authMethods from the module', () => {
    const bridge = new PrivateAdapterBridge(makeModule(), credentials, cache);

    expect(bridge.provider).toBe('fixturewise');
    expect(bridge.displayName).toBe('Fixturewise Friends');
    expect(bridge.authMethods).toEqual([{ kind: 'device_code', label: 'Sign in' }]);
  });

  it('isConnected delegates to the credential store', async () => {
    (credentials.isConnected as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const bridge = new PrivateAdapterBridge(makeModule(), credentials, cache);

    expect(await bridge.isConnected(1)).toBe(true);
    expect(credentials.isConnected).toHaveBeenCalledWith(1, 'fixturewise');
  });

  it('migratePage and pull reject, since a v2 read-only adapter has no sync surface', async () => {
    const bridge = new PrivateAdapterBridge(makeModule(), credentials, cache);
    await expect(bridge.migratePage()).rejects.toThrow('does not support migration');
    await expect(bridge.pull()).rejects.toThrow('does not support pull');
  });

  it('translates a successful getShelf, passing the decrypted credential through ctx', async () => {
    (credentials.get as ReturnType<typeof vi.fn>).mockResolvedValue({ credential: 'tok', accountLabel: null, needsReconnect: false });
    const getShelf = vi.fn().mockResolvedValue({ items: [{ title: 'Book' }] });
    const bridge = new PrivateAdapterBridge(makeModule({ getShelf }), credentials, cache);

    const items = await bridge.getShelf(1, 'friends-reading');

    expect(items).toEqual([{ title: 'Book' }]);
    expect(getShelf).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, credential: 'tok' }), 'friends-reading');
  });

  it('marks needsReconnect and returns an empty shelf on auth_expired', async () => {
    (credentials.get as ReturnType<typeof vi.fn>).mockResolvedValue({ credential: 'stale', accountLabel: null, needsReconnect: false });
    const getShelf = vi.fn().mockResolvedValue({ items: [], error: 'auth_expired' });
    const bridge = new PrivateAdapterBridge(makeModule({ getShelf }), credentials, cache);

    const items = await bridge.getShelf(1, 'friends-reading');

    expect(items).toEqual([]);
    expect(credentials.markNeedsReconnect).toHaveBeenCalledWith(1, 'fixturewise');
  });

  it('starts device auth, caches the handle, and never returns it to the caller', async () => {
    const startDeviceAuth = vi.fn().mockResolvedValue({
      handle: { id: 'h1' },
      verificationUrl: 'https://example.test/device',
      userCode: 'ABCD',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      pollIntervalSeconds: 2,
    });
    const bridge = new PrivateAdapterBridge(makeModule({ startDeviceAuth }), credentials, cache);

    const result = await bridge.startDeviceAuth(1);

    expect(result).not.toHaveProperty('handle');
    expect(result.userCode).toBe('ABCD');
    expect(cache.set).toHaveBeenCalledWith(1, 'fixturewise', 'device_auth', { handle: { id: 'h1' } }, expect.any(Number));
  });

  it('polls device auth, stores the credential on approval, and clears the cached handle', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue({ handle: { id: 'h1' } });
    const pollDeviceAuth = vi.fn().mockResolvedValue({ status: 'approved', credential: 'new-token', accountLabel: 'user@example.test' });
    const bridge = new PrivateAdapterBridge(makeModule({ pollDeviceAuth }), credentials, cache);

    const result = await bridge.pollDeviceAuth(1);

    expect(result.status).toBe('approved');
    expect(credentials.save).toHaveBeenCalledWith(1, 'fixturewise', 'new-token', 'user@example.test');
    expect(cache.set).toHaveBeenCalledWith(1, 'fixturewise', 'device_auth', { handle: null }, 0);
  });

  it('reports expired when there is no pending device-auth handle cached', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const bridge = new PrivateAdapterBridge(makeModule({ pollDeviceAuth: vi.fn() }), credentials, cache);

    const result = await bridge.pollDeviceAuth(1);

    expect(result.status).toBe('expired');
  });

  it('disconnect deletes the stored credential', async () => {
    const bridge = new PrivateAdapterBridge(makeModule(), credentials, cache);
    await bridge.disconnect(1);
    expect(credentials.disconnect).toHaveBeenCalledWith(1, 'fixturewise');
  });

  it('reports unsupported when the module has no loginWithPassword', async () => {
    const bridge = new PrivateAdapterBridge(makeModule(), credentials, cache);
    const result = await bridge.loginWithPassword(1, 'user@example.test', 'whatever');
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('passes the username and password straight through to the module on loginWithPassword', async () => {
    const loginWithPassword = vi.fn().mockResolvedValue({ ok: true, credential: 'new-token', accountLabel: 'user@example.test' });
    const bridge = new PrivateAdapterBridge(makeModule({ loginWithPassword }), credentials, cache);

    const result = await bridge.loginWithPassword(1, 'user@example.test', 'super-secret');

    expect(result).toEqual({ ok: true, credential: 'new-token', accountLabel: 'user@example.test' });
    expect(loginWithPassword).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }), { username: 'user@example.test', password: 'super-secret' });
  });

  it('passes through a failed loginWithPassword reason unchanged', async () => {
    const loginWithPassword = vi.fn().mockResolvedValue({ ok: false, reason: 'mfa_required' });
    const bridge = new PrivateAdapterBridge(makeModule({ loginWithPassword }), credentials, cache);

    const result = await bridge.loginWithPassword(1, 'user@example.test', 'wrong');

    expect(result).toEqual({ ok: false, reason: 'mfa_required' });
  });
});
