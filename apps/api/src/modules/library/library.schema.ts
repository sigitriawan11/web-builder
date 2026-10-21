import { z } from "zod";

// GET definisi versi component untuk editor/publish (CMP-158 subset / CMP-050). `componentId` = `cmp_…` yang dirujuk
// dokumen (DM-018, = components.public_id). `version` = `version_seq` integer (referensi dokumen, 03 §441).
const ComponentPublicId = z.string().regex(/^cmp_[0-9a-z]{6,24}$/, "componentId cmp_… (DM-007)");

export const getDefinitionRequest = {
  params: z.object({ componentId: ComponentPublicId, version: z.coerce.number().int().positive() }),
};

// Daftar component published utk panel Insert (T3.6.1): filter kategori (slug) & pencarian nama, opsional.
export const listComponentsRequest = {
  query: z.object({ category: z.string().max(64).optional(), search: z.string().max(100).optional() }),
};
