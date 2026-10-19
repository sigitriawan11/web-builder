ALTER TABLE "components" ADD COLUMN "public_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_publicId_unique" UNIQUE("public_id");