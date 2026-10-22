CREATE TYPE "public"."component_thumbnail_breakpoint" AS ENUM('base', 'tablet', 'mobile');--> statement-breakpoint
CREATE TABLE "component_version_thumbnails" (
	"id" uuid PRIMARY KEY NOT NULL,
	"component_version_id" uuid NOT NULL,
	"breakpoint" "component_thumbnail_breakpoint" NOT NULL,
	"asset_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "component_version_thumbnails" ADD CONSTRAINT "component_version_thumbnails_component_version_id_component_versions_id_fk" FOREIGN KEY ("component_version_id") REFERENCES "public"."component_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "component_version_thumbnails_version_bp_idx" ON "component_version_thumbnails" USING btree ("component_version_id","breakpoint");