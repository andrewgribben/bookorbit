import { boolean, check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from './auth';

export interface TkPendingOAuth {
  clientId: string;
  codeVerifier: string;
  state: string;
  redirectUri: string;
  createdAt: string;
}

export const tkUserSettings = pgTable('tk_user_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  enabled: boolean('enabled').notNull().default(false),
  disabledReason: text('disabled_reason'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

  clientId: text('client_id'),
  accessTokenEnc: text('access_token_enc'),
  refreshTokenEnc: text('refresh_token_enc'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),

  // In-flight connect attempt; cleared on success, expired after TK_PENDING_OAUTH_TTL_MS (see tk.constants.ts).
  pendingOauth: jsonb('pending_oauth').$type<TkPendingOAuth | null>(),

  lastAnnotationId: integer('last_annotation_id').notNull().default(0),
  lastJournalCreatedAt: timestamp('last_journal_created_at', { withTimezone: true }),
  lastFinishedAt: timestamp('last_finished_at', { withTimezone: true }),

  syncAnnotations: boolean('sync_annotations').notNull().default(true),
  syncJournal: boolean('sync_journal').notNull().default(true),
  syncFinished: boolean('sync_finished').notNull().default(true),

  connectedAt: timestamp('connected_at', { withTimezone: true }),
  backfillRequestedAt: timestamp('backfill_requested_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type TkUserSetting = typeof tkUserSettings.$inferSelect;
export type NewTkUserSetting = typeof tkUserSettings.$inferInsert;

export const tkSyncItems = pgTable(
  'tk_sync_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 20 }).$type<'annotation' | 'journal' | 'finished'>().notNull(),
    sourceKey: text('source_key').notNull(),
    dateKey: varchar('date_key', { length: 10 }).notNull(),
    tkDocumentId: text('tk_document_id').notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('tk_sync_items_user_kind_source_key_uidx').on(t.userId, t.kind, t.sourceKey),
    index('tk_sync_items_user_id_idx').on(t.userId),
    check('tk_sync_items_kind_chk', sql`${t.kind} in ('annotation', 'journal', 'finished')`),
  ],
);

export type TkSyncItemRow = typeof tkSyncItems.$inferSelect;
export type NewTkSyncItem = typeof tkSyncItems.$inferInsert;
