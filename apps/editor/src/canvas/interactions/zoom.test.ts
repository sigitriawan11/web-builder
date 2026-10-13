import { describe, expect, it } from "vitest";
import { screenPoint, screenToWorld, worldToScreen } from "../geometry/coordinates";
import { MAX_ZOOM, MIN_ZOOM } from "../zoom-limits";
import { nextZoomStep, wheelZoomFactor, ZOOM_STEPS, zoomAtPoint, zoomKeyDirection } from "./zoom";

const ORIGIN = { left: 0, top: 0 };

describe("zoomAtPoint (ED-027)", () => {
  const cameras = [
    { x: 0, y: 0, zoom: 1 },
    { x: -250, y: 120, zoom: 4 },
    { x: 9_000, y: -3_000, zoom: 0.05 },
  ];
  const anchors = [
    { x: 0, y: 0 },
    { x: 400, y: 300 },
    { x: 1920, y: 1080 },
  ];
  const targets = [0.05, 0.1, 0.33, 1, 2.5, 16];

  it("titik world di bawah anchor tetap di bawah anchor (error < 0.5px)", () => {
    for (const camera of cameras) {
      for (const anchor of anchors) {
        const worldBefore = screenToWorld(screenPoint(anchor.x, anchor.y), camera, ORIGIN);
        for (const target of targets) {
          const next = zoomAtPoint(camera, anchor, target);
          const screenAfter = worldToScreen(worldBefore, next, ORIGIN);

          expect(Math.abs(screenAfter.x - anchor.x)).toBeLessThan(0.5);
          expect(Math.abs(screenAfter.y - anchor.y)).toBeLessThan(0.5);
          expect(next.zoom).toBeCloseTo(target, 10);
        }
      }
    }
  });

  it("tidak pernah keluar dari rentang zoom, dan anchor tetap stabil saat di-clamp", () => {
    const camera = { x: 10, y: 20, zoom: 8 };
    const anchor = { x: 300, y: 200 };

    const tooFar = zoomAtPoint(camera, anchor, 100);
    const tooClose = zoomAtPoint(camera, anchor, 0.0001);

    expect(tooFar.zoom).toBe(MAX_ZOOM);
    expect(tooClose.zoom).toBe(MIN_ZOOM);
    const world = screenToWorld(screenPoint(anchor.x, anchor.y), camera, ORIGIN);
    expect(worldToScreen(world, tooFar, ORIGIN).x).toBeCloseTo(anchor.x, 6);
    expect(worldToScreen(world, tooClose, ORIGIN).y).toBeCloseTo(anchor.y, 6);
  });
});

describe("wheelZoomFactor", () => {
  it("deltaY negatif memperbesar, positif memperkecil, nol tidak mengubah", () => {
    expect(wheelZoomFactor(-100, 0)).toBeCloseTo(Math.E, 10);
    expect(wheelZoomFactor(100, 0)).toBeCloseTo(1 / Math.E, 10);
    expect(wheelZoomFactor(0, 0)).toBe(1);
  });

  it("mengonversi delta baris ke px sebelum menghitung faktor", () => {
    expect(wheelZoomFactor(-1, 1)).toBeCloseTo(wheelZoomFactor(-16, 0), 10);
  });

  it("gerakan maju lalu mundur yang sama kembali ke zoom awal", () => {
    expect(wheelZoomFactor(-37, 0) * wheelZoomFactor(37, 0)).toBeCloseTo(1, 12);
  });
});

describe("nextZoomStep", () => {
  it.each([
    [1, "in", 1.5],
    [1, "out", 0.75],
    [0.8, "in", 1],
    [0.8, "out", 0.75],
    [0.33, "out", 0.25],
    [16, "in", 16],
    [0.05, "out", 0.05],
    [1.0000000001, "in", 1.5],
  ] as const)("dari %f arah %s → %f", (zoom, direction, expected) => {
    expect(nextZoomStep(zoom, direction)).toBe(expected);
  });

  it("menelusuri semua preset dari 5% sampai 1600%", () => {
    const visited: number[] = [ZOOM_STEPS[0]];
    let zoom: number = ZOOM_STEPS[0];
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      zoom = nextZoomStep(zoom, "in");
      if (zoom !== visited.at(-1)) visited.push(zoom);
    }
    expect(visited).toEqual([...ZOOM_STEPS]);
  });
});

describe("zoomKeyDirection", () => {
  it.each([
    [{ key: "+", altKey: false }, "in"],
    [{ key: "=", altKey: false }, "in"],
    [{ key: "-", altKey: false }, "out"],
    [{ key: "_", altKey: false }, "out"],
    [{ key: "=", altKey: true }, null],
    [{ key: "a", altKey: false }, null],
  ])("%o → %s", (input, expected) => {
    expect(zoomKeyDirection(input)).toBe(expected);
  });
});
