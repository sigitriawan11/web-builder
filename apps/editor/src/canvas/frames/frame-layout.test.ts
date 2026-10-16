import { describe, expect, it } from "vitest";
import { FRAME_GAP, frameAtWorldX, frameOptionsFromSearch, layoutFrames } from "./frame-layout";

describe("layoutFrames (ED-034)", () => {
  it("default hanya Desktop di origin world, tinggi minimal viewport preset", () => {
    expect(layoutFrames(false)).toEqual([{ breakpoint: "base", width: 1440, x: 0, minHeight: 900 }]);
  });

  it("semua device berdampingan dengan jarak 100px world", () => {
    expect(layoutFrames(true).map(({ breakpoint, x, minHeight }) => [breakpoint, x, minHeight])).toEqual([
      ["base", 0, 900],
      ["tablet", 1440 + FRAME_GAP, 1024],
      ["mobile", 1440 + FRAME_GAP + 768 + FRAME_GAP, 812],
    ]);
  });

  it("lebar dari settings.breakpoints dokumen; mode fokus = satu frame breakpoint aktif", () => {
    const widths = { base: 1280, tablet: 800, mobile: 360 };
    expect(layoutFrames(true, { widths }).map(({ width, x }) => [width, x])).toEqual([
      [1280, 0],
      [800, 1280 + FRAME_GAP],
      [360, 1280 + FRAME_GAP + 800 + FRAME_GAP],
    ]);
    expect(layoutFrames(false, { widths, focus: "mobile" })).toEqual([
      { breakpoint: "mobile", width: 360, x: 0, minHeight: 812 },
    ]);
  });

  it("frame di bawah titik world", () => {
    const frames = layoutFrames(true);
    expect(frameAtWorldX(frames, 10)?.breakpoint).toBe("base");
    expect(frameAtWorldX(frames, 1440 + FRAME_GAP + 5)?.breakpoint).toBe("tablet");
    expect(frameAtWorldX(frames, 1440 + 50)).toBeNull();
  });
});

describe("frameOptionsFromSearch", () => {
  it.each([
    ["", { showAll: false, mode: "class" }],
    ["?frames=all", { showAll: true, mode: "class" }],
    ["?frames=all&bpMode=iframe", { showAll: true, mode: "iframe" }],
    ["?bpMode=canvas", { showAll: false, mode: "class" }],
  ])("%s", (search, expected) => {
    expect(frameOptionsFromSearch(search)).toEqual(expected);
  });
});
