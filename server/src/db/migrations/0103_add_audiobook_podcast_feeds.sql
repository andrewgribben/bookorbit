CREATE TABLE "audiobook_podcast_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"book_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audiobook_podcast_feeds" ADD CONSTRAINT "audiobook_podcast_feeds_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiobook_podcast_feeds" ADD CONSTRAINT "audiobook_podcast_feeds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audiobook_podcast_feeds_public_id_uidx" ON "audiobook_podcast_feeds" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audiobook_podcast_feeds_book_id_uidx" ON "audiobook_podcast_feeds" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "audiobook_podcast_feeds_enabled_idx" ON "audiobook_podcast_feeds" USING btree ("enabled");
