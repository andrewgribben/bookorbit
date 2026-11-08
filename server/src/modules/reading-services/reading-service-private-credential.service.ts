import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { ReadingServiceTokenService } from './reading-service-token.service';

type Db = NodePgDatabase<typeof schema>;

export interface PrivateCredentialState {
  credential: string;
  accountLabel: string | null;
  needsReconnect: boolean;
}

/**
 * Encrypted per-user, per-provider credential storage for private adapters (arbitrary provider
 * ids, unlike the fixed Readwise/Hardcover columns `ReadingServiceTokenService` already serves).
 * Reuses that service's AES-GCM key so there's exactly one place that owns
 * `READING_SERVICES_ENCRYPTION_KEY`. Never logs a credential; callers must do the same.
 */
@Injectable()
export class ReadingServicePrivateCredentialService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tokenService: ReadingServiceTokenService,
  ) {}

  async get(userId: number, provider: string): Promise<PrivateCredentialState | null> {
    const row = await this.db.query.readingServicePrivateCredentials.findFirst({
      where: and(eq(schema.readingServicePrivateCredentials.userId, userId), eq(schema.readingServicePrivateCredentials.provider, provider)),
    });
    if (!row) return null;
    return {
      credential: this.tokenService.decrypt(row.credentialEncrypted),
      accountLabel: row.accountLabel,
      needsReconnect: row.needsReconnect,
    };
  }

  async isConnected(userId: number, provider: string): Promise<boolean> {
    const row = await this.db.query.readingServicePrivateCredentials.findFirst({
      where: and(eq(schema.readingServicePrivateCredentials.userId, userId), eq(schema.readingServicePrivateCredentials.provider, provider)),
      columns: { id: true },
    });
    return row !== undefined;
  }

  async save(userId: number, provider: string, credential: string, accountLabel: string | null): Promise<void> {
    const encrypted = this.tokenService.encrypt(credential);
    await this.db
      .insert(schema.readingServicePrivateCredentials)
      .values({ userId, provider, credentialEncrypted: encrypted, accountLabel, needsReconnect: false })
      .onConflictDoUpdate({
        target: [schema.readingServicePrivateCredentials.userId, schema.readingServicePrivateCredentials.provider],
        set: { credentialEncrypted: encrypted, accountLabel, needsReconnect: false, updatedAt: new Date() },
      });
  }

  async markNeedsReconnect(userId: number, provider: string): Promise<void> {
    await this.db
      .update(schema.readingServicePrivateCredentials)
      .set({ needsReconnect: true, updatedAt: new Date() })
      .where(and(eq(schema.readingServicePrivateCredentials.userId, userId), eq(schema.readingServicePrivateCredentials.provider, provider)));
  }

  async disconnect(userId: number, provider: string): Promise<void> {
    await this.db
      .delete(schema.readingServicePrivateCredentials)
      .where(and(eq(schema.readingServicePrivateCredentials.userId, userId), eq(schema.readingServicePrivateCredentials.provider, provider)));
  }
}
