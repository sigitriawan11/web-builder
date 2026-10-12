import { describe, expect, it } from "vitest";
import {
  type AncestorOffsets,
  localPoint,
  nodeLocalToWorld,
  screenDeltaToWorld,
  screenPoint,
  screenToWorld,
  worldPoint,
  worldToNodeLocal,
  worldToScreen,
} from "./coordinates";

const EPSILON = 1e-6;
const ZOOMS = [0.05, 0.1, 0.25, 0.5, 1, 1.5, 2, 4, 8, 16];
const CAMERA_OFFSETS = [
  { x: 0, y: 0 },
  { x: 320, y: 180 },
  { x: -12_345.67, y: -9_876.5 },
];
const VIEWPORTS = [
  { left: 0, top: 0 },
  { left: 240, top: 48 },
];
const POINTS = [
  [0, 0],
  [1, 1],
  [-500.25, 730.125],
  [123_456.789, -98_765.432],
] as const;

describe("screenToWorld / worldToScreen (ED-013)", () => {
  it("memakai rumus ED-013", () => {
    const camera = { x: 100, y: -50, zoom: 2 };
    const viewport = { left: 240, top: 48 };

    expect(screenToWorld(screenPoint(540, 198), camera, viewport)).toEqual(worldPoint(100, 100));
    expect(worldToScreen(worldPoint(100, 100), camera, viewport)).toEqual(screenPoint(540, 198));
  });

  it("saling invers untuk zoom 5%–1600%, offset negatif, dan titik besar", () => {
    for (const zoom of ZOOMS) {
      for (const offset of CAMERA_OFFSETS) {
        for (const viewport of VIEWPORTS) {
          const camera = { ...offset, zoom };
          for (const [x, y] of POINTS) {
            const fromScreen = worldToScreen(screenToWorld(screenPoint(x, y), camera, viewport), camera, viewport);
            const fromWorld = screenToWorld(worldToScreen(worldPoint(x, y), camera, viewport), camera, viewport);

            expect(Math.abs(fromScreen.x - x)).toBeLessThan(EPSILON * Math.max(1, Math.abs(x)));
            expect(Math.abs(fromScreen.y - y)).toBeLessThan(EPSILON * Math.max(1, Math.abs(y)));
            expect(Math.abs(fromWorld.x - x)).toBeLessThan(EPSILON * Math.max(1, Math.abs(x)));
            expect(Math.abs(fromWorld.y - y)).toBeLessThan(EPSILON * Math.max(1, Math.abs(y)));
          }
        }
      }
    }
  });

  it("origin world berada di posisi kamera pada screen", () => {
    const camera = { x: -250, y: -250, zoom: 4 };
    const viewport = { left: 0, top: 0 };

    expect(worldToScreen(worldPoint(0, 0), camera, viewport)).toEqual(screenPoint(-250, -250));
    expect(worldToScreen(worldPoint(80, 80), camera, viewport)).toEqual(screenPoint(70, 70));
  });

  it("menandai sistem koordinat hasil konversi", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const viewport = { left: 0, top: 0 };

    expect(screenToWorld(screenPoint(1, 2), camera, viewport).__space).toBe("world");
    expect(worldToScreen(worldPoint(1, 2), camera, viewport).__space).toBe("screen");
  });
});

describe("screenDeltaToWorld", () => {
  it.each([
    [0.25, 10, -20, 40, -80],
    [1, 10, -20, 10, -20],
    [4, 10, -20, 2.5, -5],
  ])("zoom %f: delta screen (%f, %f) = delta world (%f, %f)", (zoom, dx, dy, worldDx, worldDy) => {
    expect(screenDeltaToWorld(dx, dy, zoom)).toEqual({ dx: worldDx, dy: worldDy });
  });
});

describe("nodeLocalToWorld / worldToNodeLocal (ED-015)", () => {
  // Rantai 5 level: page → section → container → card → button.
  const ancestors: AncestorOffsets = [
    { x: 0, y: 0 },
    { x: 0, y: 640 },
    { x: 120, y: 64 },
    { x: 304, y: 200 },
    { x: 16, y: 212.5 },
  ];

  it("menjumlahkan offset semua ancestor", () => {
    expect(nodeLocalToWorld(localPoint(8, 4), ancestors)).toEqual(worldPoint(448, 1120.5));
  });

  it("tanpa ancestor, local sama dengan world", () => {
    expect(nodeLocalToWorld(localPoint(-3, 7), [])).toEqual(worldPoint(-3, 7));
  });

  it("saling invers untuk node bersarang 5 level", () => {
    for (const [x, y] of POINTS) {
      const local = localPoint(x, y);
      const back = worldToNodeLocal(nodeLocalToWorld(local, ancestors), ancestors);

      expect(Math.abs(back.x - x)).toBeLessThan(EPSILON * Math.max(1, Math.abs(x)));
      expect(Math.abs(back.y - y)).toBeLessThan(EPSILON * Math.max(1, Math.abs(y)));
      expect(back.__space).toBe("local");
    }
  });
});
