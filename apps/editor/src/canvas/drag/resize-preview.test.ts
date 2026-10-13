import { describe, expect, it } from "vitest";
import { fixedSizePatch, MIN_SIZE_PX, resizedSize } from "./resize-preview";

const start = { x: 0, y: 0, width: 200, height: 100 };

describe("resizedSize (T0.6.1: handle se)", () => {
  it("menambah geser pointer world ke ukuran awal", () => {
    expect(resizedSize(start, "se", { dx: 40.123, dy: -20 })).toEqual({ width: 240.12, height: 80 });
  });

  it(`tidak pernah lebih kecil dari ${MIN_SIZE_PX}px`, () => {
    expect(resizedSize(start, "se", { dx: -500, dy: -500 })).toEqual({ width: MIN_SIZE_PX, height: MIN_SIZE_PX });
  });

  it("handle lain belum didukung (T0.6.3)", () => {
    expect(resizedSize(start, "nw", { dx: 10, dy: 10 })).toBeNull();
  });
});

describe("fixedSizePatch", () => {
  it("menghasilkan patch ukuran fixed px", () => {
    expect(fixedSizePatch({ width: 10, height: 20 })).toEqual({
      size: { width: { mode: "fixed", value: 10, unit: "px" }, height: { mode: "fixed", value: 20, unit: "px" } },
    });
  });
});
