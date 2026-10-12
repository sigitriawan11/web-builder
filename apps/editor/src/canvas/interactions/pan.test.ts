import { describe, expect, it } from "vitest";
import { LINE_HEIGHT_PX, panCamera, startsPan, wheelToPanDelta } from "./pan";

const PAGE_HEIGHT = 800;
const wheel = (deltaX: number, deltaY: number, deltaMode = 0, shiftKey = false) => ({
  deltaX,
  deltaY,
  deltaMode,
  shiftKey,
});

describe("wheelToPanDelta (ED-026)", () => {
  it("meneruskan delta piksel trackpad dua arah apa adanya", () => {
    expect(wheelToPanDelta(wheel(12.5, -30), PAGE_HEIGHT)).toEqual({ dx: 12.5, dy: -30 });
  });

  it("mengonversi delta baris (deltaMode LINE) ke px", () => {
    expect(wheelToPanDelta(wheel(0, 3, 1), PAGE_HEIGHT)).toEqual({ dx: 0, dy: 3 * LINE_HEIGHT_PX });
  });

  it("mengonversi delta halaman (deltaMode PAGE) ke tinggi halaman", () => {
    expect(wheelToPanDelta(wheel(0, 1, 2), PAGE_HEIGHT)).toEqual({ dx: 0, dy: PAGE_HEIGHT });
  });

  it("Shift + wheel vertikal menjadi pan horizontal", () => {
    expect(wheelToPanDelta(wheel(0, 100, 0, true), PAGE_HEIGHT)).toEqual({ dx: 100, dy: 0 });
  });

  it("tidak menukar sumbu lagi jika browser sudah mengirim deltaX saat Shift", () => {
    expect(wheelToPanDelta(wheel(100, 0, 0, true), PAGE_HEIGHT)).toEqual({ dx: 100, dy: 0 });
  });
});

describe("panCamera", () => {
  it("menggeser kamera berlawanan arah delta tanpa mengubah zoom", () => {
    const camera = { x: 10, y: -20, zoom: 2 };

    expect(panCamera(camera, 5, -5)).toEqual({ x: 5, y: -15 });
  });
});

describe("startsPan", () => {
  it.each([
    [1, false, true],
    [1, true, true],
    [0, true, true],
    [0, false, false],
    [2, true, false],
  ])("tombol %i, hand tool aktif %s → %s", (button, handToolActive, expected) => {
    expect(startsPan(button, handToolActive)).toBe(expected);
  });
});
