import { describe, expect, it } from "vitest";
import { jsonToYDoc, type Node, type SiteDocument, SiteDocumentSchema, yDocToJson } from "../../src";
import { generateLandingDocument, landing200, landing2000 } from "./landing-generator";

function depthOf(doc: SiteDocument, node: Node): number {
  let depth = 0;
  let parentId = node.parentId;
  while (parentId !== null) {
    depth += 1;
    parentId = doc.nodes[parentId]?.parentId ?? null;
  }
  return depth;
}

function countByType(doc: SiteDocument): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of Object.values(doc.nodes)) counts[node.type] = (counts[node.type] ?? 0) + 1;
  return counts;
}

describe.each([
  { name: "landing200", create: landing200, count: 200 },
  { name: "landing2000", create: landing2000, count: 2000 },
])("$name", ({ create, count }) => {
  const doc = create();

  it("lolos schema dan invariant dokumen", () => {
    expect(SiteDocumentSchema.safeParse(doc).error?.issues).toBeUndefined();
  });

  it(`berisi tepat ${count} node (termasuk page)`, () => {
    expect(Object.keys(doc.nodes)).toHaveLength(count);
  });

  it("bersarang 4–6 level dengan auto-layout, teks, dan gambar", () => {
    const depths = Object.values(doc.nodes).map((node) => depthOf(doc, node));
    const maxDepth = Math.max(...depths);
    expect(maxDepth).toBeGreaterThanOrEqual(4);
    expect(maxDepth).toBeLessThanOrEqual(6);

    const counts = countByType(doc);
    expect(counts.text ?? 0).toBeGreaterThan(count * 0.3);
    expect(counts.image ?? 0).toBeGreaterThan(count * 0.1);
    const flexFrames = Object.values(doc.nodes).filter(
      (node) => node.type === "frame" && node.style.base.layout?.mode === "flex",
    );
    expect(flexFrames.length).toBe(counts.frame);
  });

  it("bisa di-round-trip lewat Y.Doc", () => {
    expect(SiteDocumentSchema.parse(yDocToJson(jsonToYDoc(doc)))).toEqual(doc);
  });
});

describe("generateLandingDocument", () => {
  it.each([1, 2, 7, 8, 16, 17, 27, 57, 333])("menghasilkan tepat %i node yang valid", (nodeCount) => {
    const doc = generateLandingDocument({ nodeCount });

    expect(Object.keys(doc.nodes)).toHaveLength(nodeCount);
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("deterministik untuk seed yang sama dan berbeda untuk seed lain", () => {
    expect(generateLandingDocument({ nodeCount: 300, seed: 7 })).toEqual(
      generateLandingDocument({ nodeCount: 300, seed: 7 }),
    );
    expect(generateLandingDocument({ nodeCount: 300, seed: 7 })).not.toEqual(
      generateLandingDocument({ nodeCount: 300, seed: 8 }),
    );
  });

  it.each([0, -1, 1.5])("menolak nodeCount %s", (nodeCount) => {
    expect(() => generateLandingDocument({ nodeCount })).toThrow();
  });
});
