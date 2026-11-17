import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TkOAuthService } from './tk-oauth.service';
import * as mcpClient from './tk-mcp-client';

function makeConfig(key: string | undefined) {
  return { get: vi.fn().mockReturnValue(key) } as unknown as import('@nestjs/config').ConfigService;
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findSettings: vi.fn(),
    upsertSettings: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as import('./tk.repository').TkRepository;
}

const VALID_KEY = 'a'.repeat(64);

describe('TkOAuthService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('start throws when the encryption key is missing', async () => {
    const service = new TkOAuthService(makeRepo(), makeConfig(undefined), vi.fn() as never);
    await expect(service.start(1)).rejects.toThrow(/BOOK_REQUEST_ENCRYPTION_KEY/);
  });

  it('start registers a new client when none is stored and stores pendingOauth', async () => {
    vi.spyOn(mcpClient, 'registerTkClient').mockResolvedValue({ clientId: 'client-new' });
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue(undefined) });
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);

    const result = await service.start(1);

    expect(result.authorizeUrl).toContain('client_id=client-new');
    expect(repo.upsertSettings).toHaveBeenCalledWith(1, expect.objectContaining({ clientId: 'client-new' }));
  });

  it('start reuses an existing client id instead of registering again', async () => {
    const registerSpy = vi.spyOn(mcpClient, 'registerTkClient');
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue({ clientId: 'existing-client' }) });
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);

    const result = await service.start(1);

    expect(registerSpy).not.toHaveBeenCalled();
    expect(result.authorizeUrl).toContain('client_id=existing-client');
  });

  it('finish throws when no connection is in progress', async () => {
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue({ pendingOauth: null }) });
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);
    await expect(service.finish(1, 'http://127.0.0.1:53682/callback?code=c&state=s')).rejects.toThrow(/no.*connection/i);
  });

  it('finish throws and clears pendingOauth when the attempt has expired', async () => {
    const pendingOauth = {
      clientId: 'c1',
      codeVerifier: 'v',
      state: 's',
      redirectUri: 'http://127.0.0.1:53682/callback',
      createdAt: new Date(0).toISOString(),
    };
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue({ pendingOauth }) });
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);

    await expect(service.finish(1, 'http://127.0.0.1:53682/callback?code=c&state=s', new Date())).rejects.toThrow(/expired/i);
    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { pendingOauth: null });
  });

  it('finish throws on a state mismatch without exchanging the code', async () => {
    const exchangeSpy = vi.spyOn(mcpClient, 'exchangeTkAuthorizationCode');
    const pendingOauth = {
      clientId: 'c1',
      codeVerifier: 'v',
      state: 'expected-state',
      redirectUri: 'http://127.0.0.1:53682/callback',
      createdAt: new Date().toISOString(),
    };
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue({ pendingOauth }) });
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);

    await expect(service.finish(1, 'http://127.0.0.1:53682/callback?code=c&state=wrong-state')).rejects.toThrow(/does not match/i);
    expect(exchangeSpy).not.toHaveBeenCalled();
  });

  it('finish exchanges the code, encrypts the tokens and marks the user connected', async () => {
    vi.spyOn(mcpClient, 'exchangeTkAuthorizationCode').mockResolvedValue({
      clientId: 'c1',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: null,
    });
    const pendingOauth = {
      clientId: 'c1',
      codeVerifier: 'v',
      state: 'expected-state',
      redirectUri: 'http://127.0.0.1:53682/callback',
      createdAt: new Date().toISOString(),
    };
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue({ pendingOauth }) });
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);

    await service.finish(1, 'http://127.0.0.1:53682/callback?code=c&state=expected-state');

    const [, patch] = (repo.upsertSettings as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(patch.pendingOauth).toBeNull();
    expect(patch.enabled).toBe(true);
    expect(patch.accessTokenEnc).not.toBe('access-1');
    expect(typeof patch.accessTokenEnc).toBe('string');
  });

  it('disconnect clears tokens and pendingOauth but leaves the ledger untouched', async () => {
    const repo = makeRepo();
    const service = new TkOAuthService(repo, makeConfig(VALID_KEY), vi.fn() as never);
    await service.disconnect(1);
    expect(repo.upsertSettings).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ enabled: false, accessTokenEnc: null, refreshTokenEnc: null, pendingOauth: null }),
    );
  });

  it('getToken returns null when the encryption key is missing', () => {
    const service = new TkOAuthService(makeRepo(), makeConfig(undefined), vi.fn() as never);
    expect(service.getToken({ accessTokenEnc: 'x', refreshTokenEnc: 'y', clientId: 'c', expiresAt: null } as never)).toBeNull();
  });

  it('getToken returns null when decryption fails (key changed)', () => {
    const service = new TkOAuthService(makeRepo(), makeConfig(VALID_KEY), vi.fn() as never);
    expect(
      service.getToken({ accessTokenEnc: 'not-valid-base64==', refreshTokenEnc: 'also-bad', clientId: 'c', expiresAt: null } as never),
    ).toBeNull();
  });
});
