import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { decryptAesGcm, encryptAesGcm, parseAesGcmKey } from '../../common/secrets/aes-gcm-secret';

export interface TokenColumns {
  apiToken: string | null;
  apiTokenEncrypted: string | null;
}

/**
 * Shared AES-GCM token storage for every reading-service provider (Readwise, Hardcover). Each
 * provider keeps its own nullable `apiToken` / `apiTokenEncrypted` columns; this service decides
 * whether a row still needs migrating and performs the lazy, idempotent migrate-on-read.
 */
@Injectable()
export class ReadingServiceTokenService {
  private readonly logger = new Logger(ReadingServiceTokenService.name);
  private readonly key: Buffer | null;

  constructor(configService: ConfigService) {
    const raw = configService.get<string>('readingServices.encryptionKey') ?? '';
    this.key = parseAesGcmKey(raw);
    if (!this.key && raw.length > 0) {
      this.logger.warn(
        '[reading_services.token] [fail] errorClass=InvalidKey - READING_SERVICES_ENCRYPTION_KEY must be a 64-char hex string (32 bytes); tokens will not be encrypted',
      );
    }
  }

  isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plaintext: string): string {
    if (!this.key) return plaintext;
    return encryptAesGcm(this.key, plaintext);
  }

  decrypt(ciphertext: string): string {
    if (!this.key) return ciphertext;
    return decryptAesGcm(this.key, ciphertext);
  }

  /**
   * Returns the effective plaintext token for a row, encrypting a legacy plaintext value into
   * `apiTokenEncrypted` and nulling `apiToken` on first read. Without a valid encryption key the
   * plaintext column is served as-is and no migration happens, since there is nothing safe to
   * encrypt it with.
   */
  async getToken(row: TokenColumns | undefined, persistMigration: (encrypted: string) => Promise<void>): Promise<string | null> {
    if (!row) return null;
    if (row.apiTokenEncrypted) return this.decrypt(row.apiTokenEncrypted);
    if (!row.apiToken) return null;
    if (!this.key) return row.apiToken;

    const encrypted = this.encrypt(row.apiToken);
    await persistMigration(encrypted);
    return row.apiToken;
  }
}
