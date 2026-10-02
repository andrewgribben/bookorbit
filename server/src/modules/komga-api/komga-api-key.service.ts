import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { userApiKeys } from '../../db/schema';
import { generateApiKey, hashApiKey } from './komga-api-key';

type Db = NodePgDatabase<typeof schema>;

/** How stale last_used_at may get before a lookup refreshes it. */
const LAST_USED_REFRESH_MS = 5 * 60 * 1000;

export interface KomgaApiKeyRow {
  id: number;
  userId: number;
  label: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface KomgaApiKeyCreation extends KomgaApiKeyRow {
  /** Returned exactly once; masked on later reads. */
  key: string;
}

@Injectable()
export class KomgaApiKeyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: number, label: string): Promise<KomgaApiKeyCreation> {
    const generated = generateApiKey();
    const [row] = await this.db.insert(userApiKeys).values({ userId, label, keyHash: generated.keyHash, keyPrefix: generated.keyPrefix }).returning({
      id: userApiKeys.id,
      userId: userApiKeys.userId,
      label: userApiKeys.label,
      keyPrefix: userApiKeys.keyPrefix,
      createdAt: userApiKeys.createdAt,
      lastUsedAt: userApiKeys.lastUsedAt,
    });

    return { ...row, key: generated.key };
  }

  async listForUser(userId: number): Promise<KomgaApiKeyRow[]> {
    return this.db
      .select({
        id: userApiKeys.id,
        userId: userApiKeys.userId,
        label: userApiKeys.label,
        keyPrefix: userApiKeys.keyPrefix,
        createdAt: userApiKeys.createdAt,
        lastUsedAt: userApiKeys.lastUsedAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .orderBy(desc(userApiKeys.createdAt));
  }

  /** Scoped to the owner: a key id from another user must not be revocable. */
  async revoke(userId: number, keyId: number): Promise<boolean> {
    const deleted = await this.db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.id, keyId), eq(userApiKeys.userId, userId)))
      .returning({ id: userApiKeys.id });
    return deleted.length > 0;
  }

  async resolveUserId(presentedKey: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: userApiKeys.id, userId: userApiKeys.userId, lastUsedAt: userApiKeys.lastUsedAt })
      .from(userApiKeys)
      .where(eq(userApiKeys.keyHash, hashApiKey(presentedKey)))
      .limit(1);

    if (!row) return null;

    const now = Date.now();
    if (row.lastUsedAt === null || now - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
      await this.db
        .update(userApiKeys)
        .set({ lastUsedAt: new Date(now) })
        .where(eq(userApiKeys.id, row.id));
    }

    return row.userId;
  }
}
