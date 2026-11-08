CREATE TABLE "reading_service_private_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"credential_encrypted" text NOT NULL,
	"account_label" varchar(255),
	"needs_reconnect" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_service_private_credentials" ADD CONSTRAINT "reading_service_private_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rs_private_credentials_user_provider" ON "reading_service_private_credentials" USING btree ("user_id","provider");