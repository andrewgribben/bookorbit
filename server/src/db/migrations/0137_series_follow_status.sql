CREATE TABLE "user_series_status" (
	"user_id" integer NOT NULL,
	"series_id" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_series_status_user_id_series_id_pk" PRIMARY KEY("user_id","series_id"),
	CONSTRAINT "user_series_status_status_chk" CHECK ("user_series_status"."status" in ('reading', 'caught_up', 'completed', 'on_hold', 'dropped'))
);
--> statement-breakpoint
ALTER TABLE "user_series_status" ADD CONSTRAINT "user_series_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_series_status" ADD CONSTRAINT "user_series_status_series_id_book_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."book_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_series_status_user_status_idx" ON "user_series_status" USING btree ("user_id","status");