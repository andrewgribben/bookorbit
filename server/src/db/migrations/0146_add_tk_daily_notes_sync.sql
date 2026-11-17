CREATE TABLE "tk_sync_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"source_key" text NOT NULL,
	"date_key" varchar(10) NOT NULL,
	"tk_document_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tk_sync_items_kind_chk" CHECK ("tk_sync_items"."kind" in ('annotation', 'journal', 'finished'))
);
--> statement-breakpoint
CREATE TABLE "tk_user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"disabled_reason" text,
	"last_synced_at" timestamp with time zone,
	"client_id" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"pending_oauth" jsonb,
	"last_annotation_id" integer DEFAULT 0 NOT NULL,
	"last_journal_created_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"connected_at" timestamp with time zone,
	"backfill_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tk_user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "tk_sync_items" ADD CONSTRAINT "tk_sync_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tk_user_settings" ADD CONSTRAINT "tk_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tk_sync_items_user_kind_source_key_uidx" ON "tk_sync_items" USING btree ("user_id","kind","source_key");--> statement-breakpoint
CREATE INDEX "tk_sync_items_user_id_idx" ON "tk_sync_items" USING btree ("user_id");