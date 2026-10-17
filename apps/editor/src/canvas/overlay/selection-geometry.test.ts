import { describe, expect, it } from "vitest";
import { HANDLE_OUTSET, handlePositions, MIN_SIZE_FOR_EDGE_HANDLES, sizeLabel, unionRect } from "./selection-geometry";

describe("unionRect", () => {
  it("menggabungkan beberapa rect; kosong → null", () => {
    expect(
      unionRect([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: -5, y: 50, width: 10, height: 30 },
      ]),
    ).toEqual({ x: -5, y: 20, width: 45, height: 60 });
    expect(unionRect([])).toBeNull();
  });
});

describe("handlePositions (ED-060)", () => {
  it("node besar: 8 handle (4 sudut + 4 sisi) di tepi kotak, tanpa offset", () => {
    const handles = handlePositions({ x: 100, y: 50, width: 200, height: 80 });

    expect(Object.fromEntries(handles.map(({ handle, x, y }) => [handle, [x, y]]))).toEqual({
      nw: [100, 50],
      n: [200, 50],
      ne: [300, 50],
      e: [300, 90],
      se: [300, 130],
      s: [200, 130],
      sw: [100, 130],
      w: [100, 90],
    });
  });

  it(`node lebih kecil dari ${MIN_SIZE_FOR_EDGE_HANDLES}px screen: hanya sudut, digeser keluar ${HANDLE_OUTSET}px`, () => {
    expect(handlePositions({ x: 0, y: 0, width: 20, height: 100 }).map(({ handle }) => handle)).toEqual([
      "nw",
      "ne",
      "se",
      "sw",
    ]);
    expect(handlePositions({ x: 0, y: 0, width: 100, height: 23 })).toHaveLength(4);
    // Ikon 24px (dulu 8 handle menumpuk): kini 4 sudut di luar kotak agar bisa digrab.
    const o = HANDLE_OUTSET;
    expect(
      Object.fromEntries(handlePositions({ x: 0, y: 0, width: 24, height: 24 }).map((h) => [h.handle, [h.x, h.y]])),
    ).toEqual({
      nw: [-o, -o],
      ne: [24 + o, -o],
      se: [24 + o, 24 + o],
      sw: [-o, 24 + o],
    });
  });
});

describe("sizeLabel (ED-060)", () => {
  it("angka dibulatkan; desimal satu angka bila perlu", () => {
    expect(sizeLabel({ width: 1440, height: 559.96 }, { width: "fixed", height: "fixed" }, false)).toBe("1440 × 560");
    expect(sizeLabel({ width: 280.25, height: 48 }, { width: "fixed", height: "fixed" }, false)).toBe("280.3 × 48");
  });

  it("anak auto-layout: Hug/Fill sebagai kata, mis. Fill × 48", () => {
    expect(sizeLabel({ width: 720, height: 48 }, { width: "fill", height: "fixed" }, true)).toBe("Fill × 48");
    expect(sizeLabel({ width: 120, height: 40 }, { width: "hug", height: "hug" }, true)).toBe("Hug × Hug");
  });

  it("di luar auto-layout tetap angka walau mode hug/fill", () => {
    expect(sizeLabel({ width: 720, height: 48 }, { width: "fill", height: "hug" }, false)).toBe("720 × 48");
  });
});
