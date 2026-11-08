CREATE TABLE "user_book_reviews" (
	"user_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"review" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_book_reviews_user_id_book_id_pk" PRIMARY KEY("user_id","book_id"),
	CONSTRAINT "user_book_reviews_review_length_chk" CHECK ("user_book_reviews"."review" is null or char_length("user_book_reviews"."review") <= 10000)
);
--> statement-breakpoint
ALTER TABLE "user_book_reviews" ADD CONSTRAINT "user_book_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_book_reviews" ADD CONSTRAINT "user_book_reviews_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ubrv_user_id_idx" ON "user_book_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ubrv_book_id_idx" ON "user_book_reviews" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "ubrv_book_user_idx" ON "user_book_reviews" USING btree ("book_id","user_id");