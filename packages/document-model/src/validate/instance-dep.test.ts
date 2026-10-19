import { describe, expect, it } from "vitest";
import { createBlankSiteDocument } from "../defaults/blank-site";
import type { SiteDocument } from "../schema";
import { validateDocument } from "./validate-document";

// DM-069 INSTANCE_DEP: instance harus merujuk versi yang tercatat di componentDeps.
function docWithInstance(deps: SiteDocument["componentDeps"], version = 1): SiteDocument {
  const doc = createBlankSiteDocument({ title: "Deps" });
  const homeId = doc.pageOrder[0] as string;
  const home = doc.nodes[homeId] as Extract<SiteDocument["nodes"][string], { type: "page" }>;
  doc.nodes.n_inst0001 = {
    id: "n_inst0001",
    type: "instance",
    name: "Button",
    parentId: homeId,
    visible: true,
    locked: false,
    style: { base: {} },
    props: { componentId: "cmp_btn0001", version },
  };
  home.children.push("n_inst0001");
  doc.componentDeps = deps;
  return doc;
}

const codes = (doc: SiteDocument) => validateDocument(doc, { mode: "publish" }).errors.map((issue) => issue.code);

describe("INSTANCE_DEP (DM-069)", () => {
  it("instance dengan dep yang cocok → valid", () => {
    expect(codes(docWithInstance({ cmp_btn0001: { version: 1, source: "library" } }))).not.toContain("INSTANCE_DEP");
  });

  it("instance tanpa entri componentDeps → INSTANCE_DEP", () => {
    expect(codes(docWithInstance({}))).toContain("INSTANCE_DEP");
  });

  it("versi instance ≠ versi componentDeps → INSTANCE_DEP", () => {
    expect(codes(docWithInstance({ cmp_btn0001: { version: 2, source: "library" } }, 1))).toContain("INSTANCE_DEP");
  });
});
