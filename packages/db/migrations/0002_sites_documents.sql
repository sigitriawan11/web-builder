CREATE TYPE "public"."document_kind" AS ENUM('site', 'component', 'template');--> statement-breakpoint
CREATE TYPE "public"."document_snapshot_kind" AS ENUM('auto', 'named', 'publish', 'pre_ai');--> statement-breakpoint
CREATE TYPE "public"."document_update_origin" AS ENUM('local', 'ai', 'server', 'migration');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('draft', 'published', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "document_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"upto_seq" bigint NOT NULL,
	"state" "bytea" NOT NULL,
	"json" jsonb,
	"kind" "document_snapshot_kind" NOT NULL,
	"label" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_updates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_updates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"update" "bytea" NOT NULL,
	"origin" "document_update_origin" NOT NULL,
	"actor_id" uuid,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid,
	"kind" "document_kind" NOT NULL,
	"schema_version" integer NOT NULL,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"last_snapshot_id" uuid,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"site_id" uuid NOT NULL,
	"page_id" text NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"seo" jsonb,
	"sort_order" integer NOT NULL,
	"is_home" boolean DEFAULT false NOT NULL,
	"node_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_pages_site_id_page_id_pk" PRIMARY KEY("site_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "site_status" DEFAULT 'draft' NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sites_document_id_key" UNIQUE("document_id")
);
--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_updates" ADD CONSTRAINT "document_updates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_updates" ADD CONSTRAINT "document_updates_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_last_snapshot_id_document_snapshots_id_fk" FOREIGN KEY ("last_snapshot_id") REFERENCES "public"."document_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_snapshots_document_id_created_at_idx" ON "document_snapshots" USING btree ("document_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "document_updates_document_id_seq_key" ON "document_updates" USING btree ("document_id","seq");--> statement-breakpoint
CREATE INDEX "documents_site_id_idx" ON "documents" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "documents_kind_idx" ON "documents" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_site_id_path_key" ON "site_pages" USING btree ("site_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_one_home_key" ON "site_pages" USING btree ("site_id") WHERE "site_pages"."is_home";--> statement-breakpoint
CREATE INDEX "sites_workspace_id_deleted_at_idx" ON "sites" USING btree ("workspace_id","deleted_at");