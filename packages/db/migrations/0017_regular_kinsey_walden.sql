CREATE TYPE "public"."library_qa_status" AS ENUM('pass', 'warn', 'fail');--> statement-breakpoint
CREATE TYPE "public"."library_review_decision" AS ENUM('approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."library_review_entity" AS ENUM('component_version', 'template_version');--> statement-breakpoint
CREATE TABLE "library_qa_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" "library_review_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" "library_qa_status" NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" "library_review_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "library_review_decision" NOT NULL,
	"notes" text,
	"checklist" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_qa_results" ADD CONSTRAINT "library_qa_results_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_reviews" ADD CONSTRAINT "library_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_qa_results_entity_idx" ON "library_qa_results" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "library_reviews_entity_idx" ON "library_reviews" USING btree ("entity_type","entity_id");