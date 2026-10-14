import {
  createBlankSiteDocument,
  insertSubtree,
  jsonToYDoc,
  runCommand,
  SiteDocumentSchema,
  userOrigin,
  validateDocument,
  yDocToJson,
} from "@platform/document-model";
import { describe, expect, it } from "vitest";
import { readComponentFiles, SeedComponentFileSchema } from "../src";

// T1.11.2: format file seed component (CMP-141) — contoh button sederhana sebagai subtree biasa.
describe("seed component", () => {
  const files = readComponentFiles();

  it("contoh button-primary terbaca & lolos skema", () => {
    expect(files.map((file) => file.path)).toContain("components/elements/button-primary.component.json");
    for (const file of files) {
      const parsed = SeedComponentFileSchema.safeParse(file.json);
      expect(parsed.success, `${file.path}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it("subtree versi published bisa disisipkan ke website blank lewat command insertSubtree (valid publish)", () => {
    const seed = SeedComponentFileSchema.parse(
      files.find((file) => file.path.endsWith("button-primary.component.json"))?.json,
    );
    const [version] = seed.versions;
    if (!version) throw new Error("tanpa versi");
    const site = createBlankSiteDocument({ title: "Toko" });
    const doc = jsonToYDoc(site);
    const pageId = site.pageOrder[0] as string;
    const result = runCommand({ doc, origin: userOrigin("seed-test") }, insertSubtree, {
      parentId: pageId,
      subtree: version.definition.subtree,
    });
    expect(result.ok, result.ok ? "" : result.error.message.id).toBe(true);
    const after = SiteDocumentSchema.parse(yDocToJson(doc));
    expect(validateDocument(after, { mode: "publish" }).errors).toEqual([]);
  });

  it("menolak id DM-007 tidak valid, kind page (M3), meta tidak lengkap", () => {
    const seed = files[0]?.json as Record<string, unknown>;
    expect(SeedComponentFileSchema.safeParse({ ...seed, id: "cmp_hero_split" }).success).toBe(false);
    expect(SeedComponentFileSchema.safeParse({ ...seed, kind: "page" }).success).toBe(false);
    const meta = seed.meta as Record<string, unknown>;
    expect(SeedComponentFileSchema.safeParse({ ...seed, meta: { ...meta, tags: ["button"] } }).success).toBe(false);
    expect(
      SeedComponentFileSchema.safeParse({ ...seed, meta: { ...meta, description: { id: "pendek", en: "short" } } })
        .success,
    ).toBe(false);
  });
});
