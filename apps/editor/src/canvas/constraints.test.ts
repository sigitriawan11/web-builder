import { describe, expect, it } from "vitest";
import { type Box, propagateConstraints } from "./constraints";

// Parent 200×100 → 300×160. Child (x10,y20,40×30).
const box: Box = { x: 10, y: 20, width: 40, height: 30 };
const from = { width: 200, height: 100 };
const to = { width: 300, height: 160 };

describe("propagateConstraints (ED-098)", () => {
  it("Left/Top → tak berubah", () => {
    expect(propagateConstraints(box, { horizontal: "left", vertical: "top" }, from, to)).toEqual(box);
  });

  it("Right/Bottom → bergeser sejauh delta ukuran parent", () => {
    // dx=100, dy=60 → x110, y80.
    expect(propagateConstraints(box, { horizontal: "right", vertical: "bottom" }, from, to)).toEqual({
      x: 110,
      y: 80,
      width: 40,
      height: 30,
    });
  });

  it("Both → melar sejauh delta", () => {
    expect(propagateConstraints(box, { horizontal: "leftRight", vertical: "topBottom" }, from, to)).toEqual({
      x: 10,
      y: 20,
      width: 140,
      height: 90,
    });
  });

  it("Center → bergeser setengah delta", () => {
    expect(propagateConstraints(box, { horizontal: "center", vertical: "center" }, from, to)).toEqual({
      x: 60,
      y: 50,
      width: 40,
      height: 30,
    });
  });

  it("Scale → posisi & ukuran proporsional", () => {
    // ×1.5 horizontal, ×1.6 vertikal.
    expect(propagateConstraints(box, { horizontal: "scale", vertical: "scale" }, from, to)).toEqual({
      x: 15,
      y: 32,
      width: 60,
      height: 48,
    });
  });

  it("default (tanpa constraints) = Left/Top", () => {
    expect(propagateConstraints(box, undefined, from, to)).toEqual(box);
  });
});
