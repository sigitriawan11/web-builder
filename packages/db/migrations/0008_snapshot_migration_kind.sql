ALTER TYPE "public"."document_snapshot_kind" ADD VALUE 'migration';--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD COLUMN "json_invalid" boolean DEFAULT false NOT NULL;