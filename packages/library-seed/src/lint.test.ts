import { describe, expect, it } from "vitest";
import { lintComponent } from "./lint";

type Def = Parameters<typeof lintComponent>[0];

function def(nodes: Record<string, unknown>): Def {
  return {
    schemaVersion: 1,
    id: "cmp_lint0001",
    version: 1,
    name: "Lint",
    category: "card",
    propsSchema: [],
    rootId: "n_root0001",
    nodes,
  } as Def;
}

describe("lintComponent (CMP-015)", () => {
  it("komponen bersih → tanpa pelanggaran statis", () => {
    const d = def({
      n_root0001: {
        id: "n_root0001",
        type: "frame",
        name: "Card",
        parentId: null,
        children: ["n_t1"],
        style: { base: { layout: { mode: "flex" }, fills: { color: { $token: "color.surface" } } } },
      },
      n_t1: { id: "n_t1", type: "text", name: "Title", parentId: "n_root0001", style: { base: {} } },
    });
    expect(lintComponent(d)).toEqual([]);
  });

  it("R-NAMING: nama layer generik", () => {
    const d = def({
      n_root0001: { id: "n_root0001", type: "text", name: "Frame 12", parentId: null, style: { base: {} } },
    });
    expect(lintComponent(d).map((v) => v.rule)).toContain("R-NAMING");
  });

  it("R-AUTOLAYOUT: container ber-anak tanpa flex; dekoratif dikecualikan", () => {
    const base = (decorative: boolean) => ({
      n_root0001: {
        id: "n_root0001",
        type: "frame",
        name: "Wrap",
        parentId: null,
        decorative,
        children: ["n_t1"],
        style: { base: { layout: { mode: "none" } } },
      },
      n_t1: { id: "n_t1", type: "text", name: "Title", parentId: "n_root0001", style: { base: {} } },
    });
    expect(lintComponent(def(base(false))).find((x) => x.rule === "R-AUTOLAYOUT")?.nodeId).toBe("n_root0001");
    expect(lintComponent(def(base(true))).some((x) => x.rule === "R-AUTOLAYOUT")).toBe(false);
  });

  it("R-TOKEN: warna literal hex", () => {
    const d = def({
      n_root0001: {
        id: "n_root0001",
        type: "frame",
        name: "Card",
        parentId: null,
        style: { base: { fills: { color: "#ff0000" } } },
      },
    });
    expect(lintComponent(d).find((x) => x.rule === "R-TOKEN")?.nodeId).toBe("n_root0001");
  });

  it("R-SIZE: jumlah node > 300", () => {
    const nodes: Record<string, unknown> = {};
    for (let i = 0; i <= 300; i++)
      nodes[`n_x${i}`] = { id: `n_x${i}`, type: "text", name: `T${i}`, parentId: null, style: { base: {} } };
    expect(lintComponent(def(nodes)).some((x) => x.rule === "R-SIZE")).toBe(true);
  });
});
