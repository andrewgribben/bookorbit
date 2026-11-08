import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';

import { SensitiveEndpointThrottlerGuard } from '../../common/guards/sensitive-endpoint-throttler.guard';
import { ReadingServicesController } from './reading-services.controller';

/**
 * Behavioural coverage for the owner rule (5 attempts per 15 minutes) on
 * `POST /reading-services/:provider/auth/password`, left untested by the previous stage. Uses
 * the real `SensitiveEndpointThrottlerGuard` and a real in-memory `ThrottlerStorageService` (no
 * mocked `canActivate`), driven against the controller method's own `@Throttle` metadata, so this
 * actually exercises the guard rather than asserting the decorator was applied.
 */
function makeRequestContext(): ExecutionContext {
  const req = {
    ip: '127.0.0.1',
    ips: [],
    method: 'POST',
    url: '/reading-services/fixturewise/auth/password',
    route: { path: '/reading-services/:provider/auth/password' },
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
  };
  const res = {
    header: () => undefined,
    setHeader: () => undefined,
  };
  return {
    getHandler: () => ReadingServicesController.prototype.connectWithPassword,
    getClass: () => ReadingServicesController,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getArgs: () => [req, res],
  } as unknown as ExecutionContext;
}

function makeGuard(): SensitiveEndpointThrottlerGuard {
  return new SensitiveEndpointThrottlerGuard(
    { throttlers: [{ name: 'default', limit: 120, ttl: 60_000 }] },
    new ThrottlerStorageService(),
    new Reflector(),
  );
}

describe('ReadingServicesController password sign-in rate limit', () => {
  it('allows 5 attempts within 15 minutes and rejects the 6th', async () => {
    const guard = makeGuard();
    await guard.onModuleInit();

    for (let attempt = 1; attempt <= 5; attempt++) {
      await expect(guard.canActivate(makeRequestContext())).resolves.toBe(true);
    }

    await expect(guard.canActivate(makeRequestContext())).rejects.toThrow();
  });
});
