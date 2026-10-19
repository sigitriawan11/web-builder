import { z } from "zod";

// GET definisi versi component untuk editor/publish (CMP-158 subset / CMP-050). `componentId` = `cmp_…` yang dirujuk
// dokumen (DM-018, = components.public_id). `version` = `version_seq` integer (referensi dokumen, 03 §441).
const ComponentPublicId = z.string().regex(/^cmp_[0-9a-z]{6,24}$/, "componentId cmp_… (DM-007)");

export const getDefinitionRequest = {
  params: z.object({ componentId: ComponentPublicId, version: z.coerce.number().int().positive() }),
};
