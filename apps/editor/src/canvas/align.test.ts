import { describe, expect, it } from "vitest";
import { alignDeltas, type Box, distributeDeltas, unionBounds } from "./align";

const box = (id: string, x: number, y: number, width: number, height: number): Box => ({
  id,
  rect: { x, y, width, height },
});

describe("unionBounds", () => {
  it("menggabungkan rect", () => {
    expect(unionBounds([box("a", 10, 10, 20, 20).rect, box("b", 50, 40, 10, 30).rect])).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 60,
    });
  });
  it("kosong → null", () => {
    expect(unionBounds([])).toBeNull();
  });
});

describe("alignDeltas (ED-072)", () => {
  // A(10,10,20h), B(50,40,10w,30h) → bounds {10,10,50,60}.
  const boxes = [box("a", 10, 10, 20, 20), box("b", 50, 40, 10, 30)];
  const bounds = unionBounds(boxes.map((b) => b.rect)) as { x: number; y: number; width: number; height: number };

  it("left: tepi kiri rata ke bounds.x", () => {
    const d = alignDeltas(boxes, "left", bounds);
    expect(d.get("a")).toEqual({ dx: 0, dy: 0 });
    expect(d.get("b")).toEqual({ dx: -40, dy: 0 });
  });

  it("right: tepi kanan rata", () => {
    const d = alignDeltas(boxes, "right", bounds);
    // bounds kanan = 60. A kanan 30 → +30; B kanan 60 → 0.
    expect(d.get("a")).toEqual({ dx: 30, dy: 0 });
    expect(d.get("b")).toEqual({ dx: 0, dy: 0 });
  });

  it("hcenter: pusat X rata ke pusat bounds (35)", () => {
    const d = alignDeltas(boxes, "hcenter", bounds);
    // A pusat 20 → +15; B pusat 55 → -20.
    expect(d.get("a")).toEqual({ dx: 15, dy: 0 });
    expect(d.get("b")).toEqual({ dx: -20, dy: 0 });
  });

  it("top/bottom/vcenter menggeser sumbu Y", () => {
    expect(alignDeltas(boxes, "top", bounds).get("b")).toEqual({ dx: 0, dy: -30 });
    // bounds bawah = 70. B bawah 70 → 0; A bawah 30 → +40.
    expect(alignDeltas(boxes, "bottom", bounds).get("a")).toEqual({ dx: 0, dy: 40 });
    // pusat bounds Y = 40. A pusat 20 → +20; B pusat 55 → -15.
    expect(alignDeltas(boxes, "vcenter", bounds).get("a")).toEqual({ dx: 0, dy: 20 });
    expect(alignDeltas(boxes, "vcenter", bounds).get("b")).toEqual({ dx: 0, dy: -15 });
  });

  it("satu node align ke rect parent", () => {
    const parent = { x: 0, y: 0, width: 100, height: 100 };
    expect(alignDeltas([box("a", 10, 10, 20, 20)], "right", parent).get("a")).toEqual({ dx: 70, dy: 0 });
  });
});

describe("distributeDeltas (ED-072)", () => {
  it("3 node jarak tak sama → celah seragam, ujung tetap (AC)", () => {
    // Lebar 10 masing-masing di x=0, x=15, x=100 → span 110, sumSizes 30, gap (110-30)/2 = 40.
    const boxes = [box("a", 0, 0, 10, 10), box("mid", 15, 0, 10, 10), box("c", 100, 0, 10, 10)];
    const d = distributeDeltas(boxes, "horizontal");
    expect(d.get("a")).toEqual({ dx: 0, dy: 0 });
    // mid target x = 0 + 10 + 40 = 50 → delta 35.
    expect(d.get("mid")).toEqual({ dx: 35, dy: 0 });
    expect(d.get("c")).toEqual({ dx: 0, dy: 0 });
  });

  it("vertical mendistribusi sumbu Y", () => {
    const boxes = [box("a", 0, 0, 10, 10), box("mid", 0, 12, 10, 10), box("c", 0, 100, 10, 10)];
    const d = distributeDeltas(boxes, "vertical");
    expect(d.get("mid")).toEqual({ dx: 0, dy: 38 });
  });

  it("< 3 node → tanpa efek", () => {
    expect(distributeDeltas([box("a", 0, 0, 10, 10), box("b", 50, 0, 10, 10)], "horizontal").size).toBe(0);
  });
});
