ALTER TABLE "sessions" ADD COLUMN "geo" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_active_at" timestamp with time zone;