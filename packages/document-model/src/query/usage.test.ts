import { describe, expect, it } from "vitest";
import { createInstance, createPage, runCommand, setInstanceOverride } from "../commands";
import { createBlankSiteDocument } from "../defaults/blank-site";
import { SiteDocumentSchema } from "../schema";
import { jsonToYDoc, userOrigin, yDocToJson } from "../yjs";
import { collectComponentUsage } from "./usage";

function ok<T>(result: { ok: true; value: T } | { ok: false; error: { code: string } }): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe("collectComponentUsage (read model site_component_usage)", () => {
  it("menghitung instance per componentId@version dengan pageIds unik & hasOverrides", () => {
    const doc = jsonToYDoc(createBlankSiteDocument({ title: "Toko" }));
    const ctx = { doc, origin: userOrigin("test") };
    const home = doc.getArray<string>("pageOrder").get(0);
    const about = ok(runCommand(ctx, createPage, { title: "Tentang", path: "/tentang" }));

    // Home: 2 instance cmp_alpha001@1 (satu diberi override).
    const a1 = ok(runCommand(ctx, createInstance, { parentId: home, componentId: "cmp_alpha001", version: 1 }));
    ok(runCommand(ctx, createInstance, { parentId: home, componentId: "cmp_alpha001", version: 1 }));
    ok(runCommand(ctx, setInstanceOverride, { id: a1, path: "n_root01", patch: { visible: false } }));
    // Tentang: 1 instance cmp_beta0002@2.
    ok(runCommand(ctx, createInstance, { parentId: about, componentId: "cmp_beta0002", version: 2 }));

    const json = SiteDocumentSchema.parse(yDocToJson(doc));
    expect(collectComponentUsage(json)).toEqual([
      { componentId: "cmp_alpha001", version: 1, instanceCount: 2, pageIds: [home], hasOverrides: true },
      { componentId: "cmp_beta0002", version: 2, instanceCount: 1, pageIds: [about], hasOverrides: false },
    ]);
  });

  it("dokumen tanpa instance → kosong", () => {
    const doc = createBlankSiteDocument({ title: "Kosong" });
    expect(collectComponentUsage(doc)).toEqual([]);
  });
});
