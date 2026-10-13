import { describe, expect, it } from "vitest";
import { moveDelta, movedPosition } from "./move";

const origin = { x: 400, y: 300 };

describe("moveDelta (ED-062)", () => {
  it.each([
    [0.25, { x: 420, y: 290 }, { dx: 80, dy: -40 }],
    [1, { x: 420, y: 290 }, { dx: 20, dy: -10 }],
    [4, { x: 420, y: 290 }, { dx: 5, dy: -2.5 }],
  ])("zoom %f: geser screen dibagi zoom", (zoom, current, expected) => {
    expect(moveDelta(origin, current, zoom, false)).toEqual(expected);
  });

  it("Shift mengunci ke sumbu dominan: hanya satu sumbu berubah (AC ED-062)", () => {
    expect(moveDelta(origin, { x: 430, y: 310 }, 1, true)).toEqual({ dx: 30, dy: 0 });
    expect(moveDelta(origin, { x: 405, y: 260 }, 2, true)).toEqual({ dx: 0, dy: -20 });
  });
});

describe("movedPosition", () => {
  it("posisi awal + geser, dibulatkan ke pixel", () => {
    expect(movedPosition({ x: 80, y: 80 }, { dx: 12.6, dy: -0.4 })).toEqual({ x: 93, y: 80 });
  });
});
