import { describe, expect, it } from "vitest";
import { cameraToFit, FIT_PADDING, fitCamera, selectionCamera, unionRects } from "./fit";

const viewport = { width: 1000, height: 800 };

describe("zoom to fit / selection (ED-028)", () => {
  it("AC: page kosong → 100% di origin", () => {
    expect(fitCamera(null, viewport)).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("konten dimuat dengan padding 48 px dan terpusat", () => {
    const camera = fitCamera({ x: 0, y: 0, width: 1440, height: 900 }, viewport);
    expect(camera.zoom).toBeCloseTo((1000 - FIT_PADDING * 2) / 1440);
    // Pusat konten berada di pusat viewport.
    expect(720 * camera.zoom + camera.x).toBeCloseTo(500);
    expect(450 * camera.zoom + camera.y).toBeCloseTo(400);
  });

  it("AC: node 4×4 px → zoom ≤ 400%", () => {
    expect(selectionCamera({ x: 10, y: 10, width: 4, height: 4 }, viewport).zoom).toBe(4);
  });

  it("rect tanpa luas (garis) tidak menghasilkan zoom tak hingga", () => {
    const camera = cameraToFit({ x: 0, y: 0, width: 200, height: 0 }, viewport, 64);
    expect(Number.isFinite(camera.zoom)).toBe(true);
    expect(cameraToFit({ x: 5, y: 5, width: 0, height: 0 }, viewport, 64).zoom).toBe(1);
  });

  it("union bounding box", () => {
    expect(unionRects([])).toBeNull();
    expect(
      unionRects([
        { x: 0, y: 10, width: 10, height: 10 },
        { x: 50, y: -5, width: 5, height: 5 },
      ]),
    ).toEqual({ x: 0, y: -5, width: 55, height: 25 });
  });
});
