import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { Mock } from 'vitest';

import type { RequestUser } from '../../common/types/request-user';
import { KomgaAuthGuard, type KomgaAuthenticatedRequest } from './komga-auth.guard';
import { KomgaAuthService } from './komga-auth.service';

const ACTIVE_USER = { id: 5, active: true, username: 'reader' } as unknown as RequestUser;

function executionContext(headers: Record<string, string | undefined>): {
  context: ExecutionContext;
  request: KomgaAuthenticatedRequest;
  header: Mock;
} {
  const request = { headers } as unknown as KomgaAuthenticatedRequest;
  const header = vi.fn();

  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ header }) }),
    } as unknown as ExecutionContext,
    request,
    header,
  };
}

function basicHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

describe('KomgaAuthGuard', () => {
  const authService = { validateBasicCredentials: vi.fn() };
  const apiKeyService = { resolveUserId: vi.fn() };
  const sessionService = { isValidToken: vi.fn(), resolve: vi.fn(), create: vi.fn().mockReturnValue('test-session-token') };
  const userService = { findByIdWithPermissions: vi.fn() };

  const guard = new KomgaAuthGuard(authService as never, apiKeyService as never, sessionService as never, userService as never);

  beforeEach(() => {
    vi.clearAllMocks();
    userService.findByIdWithPermissions.mockResolvedValue(ACTIVE_USER);
  });

  it('accepts Basic credentials and attaches the full user', async () => {
    authService.validateBasicCredentials.mockResolvedValue(5);
    const { context, request } = executionContext({ authorization: basicHeader('reader', 'secret') });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(authService.validateBasicCredentials).toHaveBeenCalledWith('reader', 'secret');
    expect(request.user).toBe(ACTIVE_USER);
  });

  it('keeps a password containing colons intact', async () => {
    authService.validateBasicCredentials.mockResolvedValue(5);
    const { context } = executionContext({ authorization: basicHeader('reader', 'a:b:c') });

    await guard.canActivate(context);

    expect(authService.validateBasicCredentials).toHaveBeenCalledWith('reader', 'a:b:c');
  });

  it('rejects wrong credentials with a challenge header', async () => {
    authService.validateBasicCredentials.mockResolvedValue(null);
    const { context, header } = executionContext({ authorization: basicHeader('reader', 'wrong') });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(header).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="bookorbit komga"');
  });

  it('rejects a request with no credentials at all', async () => {
    const { context, header } = executionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(header).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="bookorbit komga"');
    expect(userService.findByIdWithPermissions).not.toHaveBeenCalled();
  });

  it('rejects a Basic header without a separator', async () => {
    const { context } = executionContext({ authorization: `Basic ${Buffer.from('nocolon').toString('base64')}` });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(authService.validateBasicCredentials).not.toHaveBeenCalled();
  });

  it('accepts an API key and attaches its owner', async () => {
    apiKeyService.resolveUserId.mockResolvedValue(5);
    const { context, request } = executionContext({ 'x-api-key': 'bko_presented' });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(apiKeyService.resolveUserId).toHaveBeenCalledWith('bko_presented');
    expect(request.user).toBe(ACTIVE_USER);
    expect(authService.validateBasicCredentials).not.toHaveBeenCalled();
  });

  it('rejects an unknown API key without falling back to Basic auth', async () => {
    apiKeyService.resolveUserId.mockResolvedValue(null);
    const { context } = executionContext({ 'x-api-key': 'bko_unknown', authorization: basicHeader('reader', 'secret') });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(authService.validateBasicCredentials).not.toHaveBeenCalled();
  });

  it('rejects a resolved account that has been disabled', async () => {
    apiKeyService.resolveUserId.mockResolvedValue(5);
    userService.findByIdWithPermissions.mockResolvedValue({ ...ACTIVE_USER, active: false });

    const { context } = executionContext({ 'x-api-key': 'bko_presented' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

describe('KomgaAuthService credential checks', () => {
  const userService = { findByUsername: vi.fn() };
  const service = new KomgaAuthService(userService as never);
  const password = 'correct-horse-battery';
  let passwordHash = '';

  function userRow(overrides: Record<string, unknown> = {}) {
    return { id: 5, passwordHash, active: true, isDefaultPassword: false, lockedUntil: null, ...overrides };
  }

  beforeAll(async () => {
    passwordHash = await hash(password, 4);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    userService.findByUsername.mockResolvedValue(userRow());
  });

  it('returns the account id for correct credentials', async () => {
    await expect(service.validateBasicCredentials('reader', password)).resolves.toBe(5);
  });

  it('returns null for a wrong password', async () => {
    await expect(service.validateBasicCredentials('reader', 'wrong')).resolves.toBeNull();
  });

  it('returns null for an unknown username without leaking that it does not exist', async () => {
    userService.findByUsername.mockResolvedValue(null);

    await expect(service.validateBasicCredentials('ghost', password)).resolves.toBeNull();
  });

  it('refuses inactive, default-password and locked accounts', async () => {
    userService.findByUsername.mockResolvedValue(userRow({ active: false }));
    await expect(service.validateBasicCredentials('reader', password)).resolves.toBeNull();

    userService.findByUsername.mockResolvedValue(userRow({ isDefaultPassword: true }));
    await expect(service.validateBasicCredentials('reader', password)).resolves.toBeNull();

    userService.findByUsername.mockResolvedValue(userRow({ lockedUntil: new Date(Date.now() + 60_000) }));
    await expect(service.validateBasicCredentials('reader', password)).resolves.toBeNull();
  });

  it('accepts an account whose lockout has expired', async () => {
    userService.findByUsername.mockResolvedValue(userRow({ lockedUntil: new Date(Date.now() - 60_000) }));

    await expect(service.validateBasicCredentials('reader', password)).resolves.toBe(5);
  });
});
