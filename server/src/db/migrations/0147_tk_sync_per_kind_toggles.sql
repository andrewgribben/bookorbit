ALTER TABLE "tk_user_settings" ADD COLUMN "sync_annotations" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tk_user_settings" ADD COLUMN "sync_journal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tk_user_settings" ADD COLUMN "sync_finished" boolean DEFAULT true NOT NULL;