CREATE TYPE "public"."asset_kind" AS ENUM('image', 'video', 'file', 'font', 'svg');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'ready', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'staff', 'system', 'ai');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid,
	"kind" "asset_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"blurhash" text,
	"sha256" text,
	"variants" jsonb,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assets_id_format" CHECK ("assets"."id" ~ '^ast_[0-9a-z]{6,24}$'),
	CONSTRAINT "assets_size_nonnegative" CHECK ("assets"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "storage_usage" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"bytes_used" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_usage_bytes_nonnegative" CHECK ("storage_usage"."bytes_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" text,
	"impersonator_id" text,
	"workspace_id" uuid,
	"site_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_usage" ADD CONSTRAINT "storage_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_site_id_created_at_idx" ON "assets" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_workspace_id_sha256_idx" ON "assets" USING btree ("workspace_id","sha256");--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_site_id_created_at_idx" ON "audit_logs" USING btree ("site_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs" USING btree ("actor_id","created_at");