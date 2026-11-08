import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import type { SyncRunProgressCounters } from '@bookorbit/types';

import { users } from './auth';
import { books } from './books';

export const readingServiceFeatures = pgTable(
  'reading_service_features',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    feature: varchar('feature', { length: 32 }).notNull(),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('reading_service_features_user_provider_feature').on(t.userId, t.provider, t.feature)],
);

export const readingServiceBookLinks = pgTable(
  'reading_service_book_links',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    // Not unique: several local editions can collapse onto one remote book id.
    externalBookId: varchar('external_book_id', { length: 128 }).notNull(),
    matchMethod: varchar('match_method', { length: 32 }).notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull().default({}),
    remoteDeleted: boolean('remote_deleted').notNull().default(false),
    excluded: boolean('excluded').notNull().default(false),
    syncError: text('sync_error'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('rs_book_links_user_provider_book').on(t.userId, t.provider, t.bookId),
    index('rs_book_links_user_provider_external').on(t.userId, t.provider, t.externalBookId),
  ],
);

export const readingServiceItemLinks = pgTable(
  'reading_service_item_links',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    localId: integer('local_id').notNull(),
    externalId: varchar('external_id', { length: 128 }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rs_item_links_local').on(t.userId, t.provider, t.kind, t.localId),
    uniqueIndex('rs_item_links_external').on(t.userId, t.provider, t.kind, t.externalId),
  ],
);

export const readingServiceRuns = pgTable(
  'reading_service_runs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    cursor: jsonb('cursor').$type<Record<string, unknown>>().notNull().default({}),
    counters: jsonb('counters').$type<SyncRunProgressCounters>().notNull(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('rs_runs_user_provider').on(t.userId, t.provider, t.startedAt)],
);

export const readingServiceCache = pgTable(
  'reading_service_cache',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    key: varchar('key', { length: 128 }).notNull(),
    payload: jsonb('payload').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider, t.key] })],
);

export type ReadingServiceFeatureRow = typeof readingServiceFeatures.$inferSelect;
export type NewReadingServiceFeatureRow = typeof readingServiceFeatures.$inferInsert;
export type ReadingServiceBookLink = typeof readingServiceBookLinks.$inferSelect;
export type NewReadingServiceBookLink = typeof readingServiceBookLinks.$inferInsert;
export type ReadingServiceItemLink = typeof readingServiceItemLinks.$inferSelect;
export type NewReadingServiceItemLink = typeof readingServiceItemLinks.$inferInsert;
export type ReadingServiceRun = typeof readingServiceRuns.$inferSelect;
export type NewReadingServiceRun = typeof readingServiceRuns.$inferInsert;
export type ReadingServiceCacheRow = typeof readingServiceCache.$inferSelect;
export type NewReadingServiceCacheRow = typeof readingServiceCache.$inferInsert;
