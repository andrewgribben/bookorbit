import { ConfigService } from '@nestjs/config';

import { decryptAesGcm } from '../../common/secrets/aes-gcm-secret';
import { ReadingServiceTokenService } from './reading-service-token.service';

const VALID_KEY = 'a'.repeat(64);

function makeService(key: string | undefined): ReadingServiceTokenService {
  const config = { get: vi.fn().mockReturnValue(key) } as unknown as ConfigService;
  return new ReadingServiceTokenService(config);
}

describe('ReadingServiceTokenService', () => {
  it('round-trips a plaintext token through encrypt and decrypt', () => {
    const service = makeService(VALID_KEY);
    const encrypted = service.encrypt('my-secret-token');

    expect(encrypted).not.toBe('my-secret-token');
    expect(service.decrypt(encrypted)).toBe('my-secret-token');
    expect(decryptAesGcm(Buffer.from(VALID_KEY, 'hex'), encrypted)).toBe('my-secret-token');
  });

  it('lazily migrates a plaintext row, nulling the plaintext column once encrypted', async () => {
    const service = makeService(VALID_KEY);
    const persistMigration = vi.fn().mockResolvedValue(undefined);

    const token = await service.getToken({ apiToken: 'plain-token', apiTokenEncrypted: null }, persistMigration);

    expect(token).toBe('plain-token');
    expect(persistMigration).toHaveBeenCalledTimes(1);
    const [encrypted] = persistMigration.mock.calls[0]!;
    expect(service.decrypt(encrypted)).toBe('plain-token');
  });

  it('is idempotent: a row already migrated is only ever decrypted', async () => {
    const service = makeService(VALID_KEY);
    const encrypted = service.encrypt('plain-token');
    const persistMigration = vi.fn();

    const token = await service.getToken({ apiToken: null, apiTokenEncrypted: encrypted }, persistMigration);

    expect(token).toBe('plain-token');
    expect(persistMigration).not.toHaveBeenCalled();
  });

  it('returns null when neither column has a token', async () => {
    const service = makeService(VALID_KEY);
    const token = await service.getToken({ apiToken: null, apiTokenEncrypted: null }, vi.fn());
    expect(token).toBeNull();
  });

  it('returns undefined-safe null when there is no row at all', async () => {
    const service = makeService(VALID_KEY);
    const token = await service.getToken(undefined, vi.fn());
    expect(token).toBeNull();
  });

  it('serves plaintext without migrating when no encryption key is configured', async () => {
    const service = makeService(undefined);
    const persistMigration = vi.fn();

    expect(service.isConfigured()).toBe(false);
    const token = await service.getToken({ apiToken: 'plain-token', apiTokenEncrypted: null }, persistMigration);

    expect(token).toBe('plain-token');
    expect(persistMigration).not.toHaveBeenCalled();
  });

  it('serves plaintext without migrating when the configured key is malformed', async () => {
    const service = makeService('not-a-valid-hex-key');
    const persistMigration = vi.fn();

    expect(service.isConfigured()).toBe(false);
    const token = await service.getToken({ apiToken: 'plain-token', apiTokenEncrypted: null }, persistMigration);

    expect(token).toBe('plain-token');
    expect(persistMigration).not.toHaveBeenCalled();
  });
});
