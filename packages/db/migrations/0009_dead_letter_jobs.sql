CREATE TYPE "public"."dead_letter_status" AS ENUM('open', 'retried', 'discarded');--> statement-breakpoint
CREATE TABLE "dead_letter_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"job_id" text NOT NULL,
	"job_name" text NOT NULL,
	"payload" jsonb,
	"error" jsonb NOT NULL,
	"attempts" integer NOT NULL,
	"request_id" text,
	"status" "dead_letter_status" DEFAULT 'open' NOT NULL,
	"failed_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_status_failed_at_idx" ON "dead_letter_jobs" USING btree ("status","failed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_queue_job_id_idx" ON "dead_letter_jobs" USING btree ("queue","job_id");