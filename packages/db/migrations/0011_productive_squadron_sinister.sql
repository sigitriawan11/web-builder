CREATE TYPE "public"."component_kind" AS ENUM('element', 'block', 'section', 'page', 'layout');--> statement-breakpoint
CREATE TYPE "public"."library_category_type" AS ENUM('functional', 'industry');--> statement-breakpoint
CREATE TYPE "public"."library_owner_type" AS ENUM('platform', 'user', 'vendor');--> statement-breakpoint
CREATE TYPE "public"."library_scope" AS ENUM('component', 'template', 'both');--> statement-breakpoint
CREATE TYPE "public"."library_status" AS ENUM('draft', 'in_review', 'published', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."version_bump" AS ENUM('major', 'minor', 'patch');--> statement-breakpoint
CREATE TABLE "component_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"component_id" uuid NOT NULL,
	"version" text,
	"version_seq" integer,
	"bump" "version_bump",
	"status" "library_status" DEFAULT 'draft' NOT NULL,
	"yanked" boolean DEFAULT false NOT NULL,
	"definition" jsonb NOT NULL,
	"props_schema_hash" text,
	"content_hash" text,
	"changelog" jsonb,
	"qa_report" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"owner_type" "library_owner_type" NOT NULL,
	"owner_id" uuid,
	"kind" "component_kind" NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"keywords" jsonb,
	"industries" text[] DEFAULT '{}' NOT NULL,
	"ai_hints" text,
	"requires_features" text[] DEFAULT '{}' NOT NULL,
	"min_plan" text,
	"status" "library_status" DEFAULT 'draft' NOT NULL,
	"latest_version_id" uuid,
	"latest_version" text,
	"draft_version_id" uuid,
	"replaced_by_component_id" uuid,
	"thumbnail_url" text,
	"usage_site_count" integer DEFAULT 0 NOT NULL,
	"generated_by_ai" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"deprecated_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"scope" "library_scope" NOT NULL,
	"type" "library_category_type" NOT NULL,
	"parent_id" uuid,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "component_versions" ADD CONSTRAINT "component_versions_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_versions" ADD CONSTRAINT "component_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_category_id_library_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_replaced_by_component_id_components_id_fk" FOREIGN KEY ("replaced_by_component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_parent_id_library_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."library_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "component_versions_component_version_idx" ON "component_versions" USING btree ("component_id","version");--> statement-breakpoint
CREATE INDEX "component_versions_component_seq_idx" ON "component_versions" USING btree ("component_id","version_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "components_platform_slug_idx" ON "components" USING btree ("owner_type","slug") WHERE "components"."owner_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "components_owner_slug_idx" ON "components" USING btree ("owner_type","owner_id","slug") WHERE "components"."owner_id" is not null;--> statement-breakpoint
CREATE INDEX "components_owner_status_idx" ON "components" USING btree ("owner_type","status");--> statement-breakpoint
CREATE INDEX "components_category_idx" ON "components" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "components_tags_idx" ON "components" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "components_industries_idx" ON "components" USING gin ("industries");--> statement-breakpoint
-- CMP-152/CMP-044: component_versions IMMUTABLE setelah published (P-1). Trigger menolak UPDATE pada baris published.
CREATE OR REPLACE FUNCTION component_versions_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'component_versions % is published and immutable (create a new version instead)', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER component_versions_no_update_published
  BEFORE UPDATE ON component_versions
  FOR EACH ROW EXECUTE FUNCTION component_versions_immutable();
