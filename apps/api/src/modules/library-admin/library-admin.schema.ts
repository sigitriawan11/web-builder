import { z } from "zod";

// Request admin library (CMP-159). Definisi component divalidasi lebih dalam oleh `validateComponentDefinition`
// (@platform/document-model) di service; di sini cukup objek. Label dwibahasa wajib ID+EN (ACC-292).
const Localized = z.object({ id: z.string().min(1), en: z.string().min(1) });
const LocalizedList = z.object({ id: z.array(z.string()), en: z.array(z.string()) });
const ComponentKind = z.enum(["element", "block", "section", "page", "layout"]);
const IdParams = z.object({ id: z.uuid() });

const metadataFields = {
  name: z.string().min(1),
  displayName: Localized,
  description: Localized,
  tags: z.array(z.string()).optional(),
  keywords: LocalizedList.optional(),
  industries: z.array(z.string()).optional(),
  aiHints: z.string().optional(),
  minPlan: z.string().optional(),
};

export const createComponentRequest = {
  body: z.object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "slug kebab-case"),
    categoryId: z.uuid(),
    kind: ComponentKind,
    ...metadataFields,
    // Subtree awal (CMP-011) → draft versi pertama.
    definition: z.unknown(),
  }),
};

export const saveDraftRequest = {
  params: IdParams,
  body: z.object({
    definition: z.unknown().optional(),
    name: z.string().min(1).optional(),
    displayName: Localized.optional(),
    description: Localized.optional(),
    tags: z.array(z.string()).optional(),
    keywords: LocalizedList.optional(),
    industries: z.array(z.string()).optional(),
    aiHints: z.string().optional(),
    minPlan: z.string().nullable().optional(),
  }),
};

export const publishRequest = {
  params: IdParams,
  body: z.object({ bump: z.enum(["major", "minor", "patch"]), changelog: Localized }),
};

export const deprecateRequest = {
  params: IdParams,
  body: z.object({ replacedBy: z.uuid().optional() }),
};

export const archiveRequest = { params: IdParams, body: z.object({}).optional() };

export const usageRequest = { params: IdParams };
