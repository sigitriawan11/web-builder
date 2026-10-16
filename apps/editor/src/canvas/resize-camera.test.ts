import { describe, expect, it } from "vitest";
import { screenPoint, screenToWorld } from "./geometry/coordinates";
import { cameraForResize } from "./resize-camera";

describe("cameraForResize (AC ED-007)", () => {
  it("titik world di pusat viewport tetap di pusat setelah viewport menyempit/melebar", () => {
    const camera = { x: 120, y: -40, zoom: 0.75 };
    const before = { width: 1000, height: 700 };
    const after = { width: 860, height: 700 };
    const origin = { left: 0, top: 0 };
    const centerBefore = screenToWorld(screenPoint(before.width / 2, before.height / 2), camera, origin);
    const moved = cameraForResize(camera, before, after);
    const centerAfter = screenToWorld(screenPoint(after.width / 2, after.height / 2), moved, origin);
    expect(centerAfter.x).toBeCloseTo(centerBefore.x);
    expect(centerAfter.y).toBeCloseTo(centerBefore.y);
    expect(moved.zoom).toBe(0.75);
  });
});
