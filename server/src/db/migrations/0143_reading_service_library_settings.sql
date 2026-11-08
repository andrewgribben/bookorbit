CREATE TABLE "reading_service_library_settings" (
	"user_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"library_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_service_library_settings_user_id_provider_library_id_pk" PRIMARY KEY("user_id","provider","library_id")
);
--> statement-breakpoint
ALTER TABLE "reading_service_library_settings" ADD CONSTRAINT "reading_service_library_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_service_library_settings" ADD CONSTRAINT "reading_service_library_settings_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;