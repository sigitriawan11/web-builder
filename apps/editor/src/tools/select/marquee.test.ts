import { describe, expect, it } from "vitest";
import { marqueeHits, rectFromPoints, rectsIntersect, resolvePressTarget } from "./marquee";
import type { NodeInfo } from "./selection-depth";

describe("rectFromPoints", () => {
  it("menormalisasi drag ke segala arah", () => {
    const expected = { x: 10, y: 20, width: 30, height: 40 };
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual(expected);
    expect(rectFromPoints({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual(expected);
    expect(rectFromPoints({ x: 40, y: 20 }, { x: 10, y: 60 })).toEqual(expected);
  });
});

describe("rectsIntersect (ED-053: intersect, bukan contain)", () => {
  const box = { x: 100, y: 100, width: 50, height: 50 };

  it.each([
    ["tercakup penuh", { x: 90, y: 90, width: 80, height: 80 }, true],
    ["bersinggungan sebagian", { x: 140, y: 140, width: 30, height: 30 }, true],
    ["marquee di dalam node", { x: 110, y: 110, width: 5, height: 5 }, true],
    ["hanya bersentuhan di tepi", { x: 150, y: 100, width: 20, height: 20 }, false],
    ["terpisah", { x: 200, y: 200, width: 10, height: 10 }, false],
  ])("%s → %s", (_, marquee, expected) => {
    expect(rectsIntersect(marquee, box)).toBe(expected);
    expect(rectsIntersect(box, marquee)).toBe(expected);
  });
});

describe("marqueeHits", () => {
  const candidates = [
    { id: "a", rect: { x: 0, y: 0, width: 100, height: 100 } },
    { id: "b", rect: { x: 200, y: 0, width: 100, height: 100 } },
    { id: "unmeasured", rect: null },
  ];

  it("mengembalikan node yang bersinggungan, urut seperti kandidat; rect belum terukur dilewati", () => {
    expect(marqueeHits({ x: 50, y: 50, width: 200, height: 10 }, candidates)).toEqual(["a", "b"]);
    expect(marqueeHits({ x: 50, y: 50, width: 10, height: 10 }, candidates)).toEqual(["a"]);
  });

  it("marquee berukuran nol tidak mengenai apa pun", () => {
    expect(marqueeHits({ x: 50, y: 50, width: 0, height: 0 }, candidates)).toEqual([]);
  });
});

describe("resolvePressTarget (ED-053)", () => {
  const tree: Record<string, NodeInfo> = {
    page: { type: "page", parentId: null },
    hero: { type: "frame", parentId: "page", role: "section" },
    title: { type: "text", parentId: "hero" },
  };
  const lookup = (id: string) => tree[id] ?? null;
  const hit = (...path: string[]) => ({ nodeId: path[0] ?? "", path });

  it("di luar page → marquee top-level", () => {
    expect(resolvePressTarget(null, [], lookup)).toEqual({ kind: "empty", scopeId: null, path: [] });
  });

  it("latar page → marquee atas section", () => {
    expect(resolvePressTarget(hit("page"), [], lookup)).toEqual({ kind: "empty", scopeId: "page", path: ["page"] });
  });

  it("latar frame yang sedang dimasuki (anaknya terseleksi) → marquee di dalam frame itu", () => {
    expect(resolvePressTarget(hit("hero", "page"), ["title"], lookup)).toEqual({
      kind: "empty",
      scopeId: "hero",
      path: ["hero", "page"],
    });
  });

  it("latar frame biasa atau node lain → node (drag = pindah)", () => {
    expect(resolvePressTarget(hit("hero", "page"), [], lookup)).toEqual({ kind: "node", nodeId: "hero", path: ["hero", "page"] });
    expect(resolvePressTarget(hit("hero", "page"), ["hero"], lookup).kind).toBe("node");
    expect(resolvePressTarget(hit("title", "hero", "page"), [], lookup).kind).toBe("node");
  });
});
