import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const userApiKeys = pgTable(
  'user_api_keys',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    // Only the SHA-256 of the key is stored; the presented header is hashed and looked up.
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    // Kept so the owning user can tell keys apart in a list without a second reveal.
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('user_api_keys_key_hash_uidx').on(t.keyHash),
    index('user_api_keys_user_id_idx').on(t.userId, t.createdAt),
    check('user_api_keys_label_not_blank_chk', sql`length(btrim(${t.label})) > 0`),
  ],
);

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;
