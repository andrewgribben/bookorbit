import { ForbiddenException } from '@nestjs/common';

import { KomgaEnabledGuard } from './komga-enabled.guard';
import type { AppSettingsService } from '../app-settings/app-settings.service';

function makeGuard(settings: { key: string; value: string }[]) {
  const appSettingsService = { listSettings: vi.fn().mockResolvedValue(settings) } as unknown as AppSettingsService;
  return new KomgaEnabledGuard(appSettingsService);
}

describe('KomgaEnabledGuard', () => {
  it('passes when komga_enabled is true', async () => {
    const guard = makeGuard([{ key: 'komga_enabled', value: 'true' }]);
    await expect(guard.canActivate()).resolves.toBe(true);
  });

  it('throws ForbiddenException when komga_enabled is false', async () => {
    const guard = makeGuard([{ key: 'komga_enabled', value: 'false' }]);
    await expect(guard.canActivate()).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when komga_enabled setting is missing', async () => {
    const guard = makeGuard([]);
    await expect(guard.canActivate()).rejects.toThrow(ForbiddenException);
  });
});
