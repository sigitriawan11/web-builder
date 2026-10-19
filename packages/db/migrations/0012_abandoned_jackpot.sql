CREATE TYPE "public"."theme_mode" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."usage_doc_state" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "site_component_usage" (
	"site_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"component_version_id" uuid,
	"version" text NOT NULL,
	"doc_state" "usage_doc_state" NOT NULL,
	"instance_count" integer DEFAULT 0 NOT NULL,
	"page_ids" text[] DEFAULT '{}' NOT NULL,
	"has_overrides" boolean DEFAULT false NOT NULL,
	"last_indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_component_usage_site_id_component_id_version_doc_state_pk" PRIMARY KEY("site_id","component_id","version","doc_state")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"owner_type" "library_owner_type" NOT NULL,
	"owner_id" uuid,
	"display_name" jsonb NOT NULL,
	"tokens" jsonb NOT NULL,
	"mode" "theme_mode" DEFAULT 'light' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"industries" text[] DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "library_status" DEFAULT 'draft' NOT NULL,
	"preview_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_component_usage" ADD CONSTRAINT "site_component_usage_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_component_usage" ADD CONSTRAINT "site_component_usage_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_component_usage" ADD CONSTRAINT "site_component_usage_component_version_id_component_versions_id_fk" FOREIGN KEY ("component_version_id") REFERENCES "public"."component_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_component_usage_component_version_idx" ON "site_component_usage" USING btree ("component_id","version");--> statement-breakpoint
CREATE INDEX "site_component_usage_site_idx" ON "site_component_usage" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "themes_platform_slug_idx" ON "themes" USING btree ("owner_type","slug") WHERE "themes"."owner_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "themes_owner_slug_idx" ON "themes" USING btree ("owner_type","owner_id","slug") WHERE "themes"."owner_id" is not null;