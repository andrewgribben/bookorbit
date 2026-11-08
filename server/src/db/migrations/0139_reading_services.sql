CREATE TABLE "reading_service_book_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"book_id" integer NOT NULL,
	"external_book_id" varchar(128) NOT NULL,
	"match_method" varchar(32) NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remote_deleted" boolean DEFAULT false NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"sync_error" text,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reading_service_cache" (
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"key" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reading_service_cache_user_id_provider_key_pk" PRIMARY KEY("user_id","provider","key")
);
--> statement-breakpoint
CREATE TABLE "reading_service_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"feature" varchar(32) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_service_item_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"local_id" integer NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"content_hash" varchar(64),
	"deleted_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_service_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"counters" jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hardcover_user_settings" ALTER COLUMN "api_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hardcover_user_settings" ADD COLUMN "api_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "readwise_user_settings" ADD COLUMN "api_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "reading_service_book_links" ADD CONSTRAINT "reading_service_book_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_book_links" ADD CONSTRAINT "reading_service_book_links_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_cache" ADD CONSTRAINT "reading_service_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_features" ADD CONSTRAINT "reading_service_features_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_item_links" ADD CONSTRAINT "reading_service_item_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_runs" ADD CONSTRAINT "reading_service_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rs_book_links_user_provider_book" ON "reading_service_book_links" USING btree ("user_id","provider","book_id");--> statement-breakpoint
CREATE INDEX "rs_book_links_user_provider_external" ON "reading_service_book_links" USING btree ("user_id","provider","external_book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_service_features_user_provider_feature" ON "reading_service_features" USING btree ("user_id","provider","feature");--> statement-breakpoint
CREATE UNIQUE INDEX "rs_item_links_local" ON "reading_service_item_links" USING btree ("user_id","provider","kind","local_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rs_item_links_external" ON "reading_service_item_links" USING btree ("user_id","provider","kind","external_id");--> statement-breakpoint
CREATE INDEX "rs_runs_user_provider" ON "reading_service_runs" USING btree ("user_id","provider","started_at");