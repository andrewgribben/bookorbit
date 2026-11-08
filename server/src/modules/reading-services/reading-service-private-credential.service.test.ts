import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decryptAesGcm } from '../../common/secrets/aes-gcm-secret';
import { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';
import { ReadingServiceTokenService } from './reading-service-token.service';

const VALID_KEY = 'b'.repeat(64);

function makeTokenService(): ReadingServiceTokenService {
  const config = { get: vi.fn().mockReturnValue(VALID_KEY) } as unknown as import('@nestjs/config').ConfigService;
  return new ReadingServiceTokenService(config);
}

describe('ReadingServicePrivateCredentialService', () => {
  let findFirst: ReturnType<typeof vi.fn>;
  let insertValues: ReturnType<typeof vi.fn>;
  let onConflictDoUpdate: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let updateSet: ReturnType<typeof vi.fn>;
  let deleteWhere: ReturnType<typeof vi.fn>;
  let service: ReadingServicePrivateCredentialService;
  let tokenService: ReadingServiceTokenService;

  beforeEach(() => {
    findFirst = vi.fn();
    onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate });
    updateWhere = vi.fn().mockResolvedValue(undefined);
    updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    deleteWhere = vi.fn().mockResolvedValue(undefined);

    const db = {
      query: { readingServicePrivateCredentials: { findFirst } },
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      delete: vi.fn().mockReturnValue({ where: deleteWhere }),
    };

    tokenService = makeTokenService();
    service = new ReadingServicePrivateCredentialService(db as never, tokenService);
  });

  it('stores a credential as AES-GCM ciphertext, never plaintext', async () => {
    await service.save(1, 'fixturewise', 'super-secret-credential', 'fixture-user@example.test');

    expect(insertValues).toHaveBeenCalledTimes(1);
    const [row] = insertValues.mock.calls[0]!;
    expect(row.credentialEncrypted).not.toContain('super-secret-credential');
    expect(decryptAesGcm(Buffer.from(VALID_KEY, 'hex'), row.credentialEncrypted)).toBe('super-secret-credential');
    expect(row.needsReconnect).toBe(false);
  });

  it('decrypts a stored credential on read and never returns the ciphertext', async () => {
    const encrypted = tokenService.encrypt('super-secret-credential');
    findFirst.mockResolvedValueOnce({ credentialEncrypted: encrypted, accountLabel: 'fixture-user@example.test', needsReconnect: false });

    const result = await service.get(1, 'fixturewise');

    expect(result).toEqual({ credential: 'super-secret-credential', accountLabel: 'fixture-user@example.test', needsReconnect: false });
  });

  it('returns null when no credential row exists', async () => {
    findFirst.mockResolvedValueOnce(undefined);
    expect(await service.get(1, 'fixturewise')).toBeNull();
    expect(await service.isConnected(1, 'fixturewise')).toBe(false);
  });

  it('marks a credential as needing reconnect without deleting it', async () => {
    await service.markNeedsReconnect(1, 'fixturewise');
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ needsReconnect: true }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('deletes the credential row on disconnect', async () => {
    await service.disconnect(1, 'fixturewise');
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
