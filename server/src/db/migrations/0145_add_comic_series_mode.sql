CREATE TABLE "reading_service_series_book_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"series_id" integer NOT NULL,
	"external_book_id" varchar(128) NOT NULL,
	"total_pages" integer DEFAULT 0 NOT NULL,
	"status" varchar(32),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_service_library_settings" ADD COLUMN "series_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reading_service_series_book_links" ADD CONSTRAINT "reading_service_series_book_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_series_book_links" ADD CONSTRAINT "reading_service_series_book_links_series_id_book_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."book_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rs_series_book_links_user_provider_series" ON "reading_service_series_book_links" USING btree ("user_id","provider","series_id");--> statement-breakpoint
CREATE INDEX "rs_series_book_links_user_provider_external" ON "reading_service_series_book_links" USING btree ("user_id","provider","external_book_id");