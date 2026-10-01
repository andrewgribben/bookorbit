import { boolean, index, integer, pgTable, serial, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { books } from './books';
import { timestamptz } from './columns';

export const audiobookPodcastFeeds = pgTable(
  'audiobook_podcast_feeds',
  {
    id: serial('id').primaryKey(),
    publicId: uuid('public_id').notNull().defaultRandom(),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('audiobook_podcast_feeds_public_id_uidx').on(t.publicId),
    uniqueIndex('audiobook_podcast_feeds_book_id_uidx').on(t.bookId),
    index('audiobook_podcast_feeds_enabled_idx').on(t.enabled),
  ],
);

export type AudiobookPodcastFeed = typeof audiobookPodcastFeeds.$inferSelect;
export type NewAudiobookPodcastFeed = typeof audiobookPodcastFeeds.$inferInsert;
