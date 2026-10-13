import { describe, expect, it } from "vitest";
import { FRAME_GAP, frameOptionsFromSearch, layoutFrames } from "./frame-layout";

describe("layoutFrames (ED-034)", () => {
  it("default hanya Desktop di origin world", () => {
    expect(layoutFrames(false)).toEqual([{ breakpoint: "base", label: "Desktop", width: 1440, x: 0 }]);
  });

  it("semua device berdampingan dengan jarak 100px world", () => {
    expect(layoutFrames(true).map(({ breakpoint, x }) => [breakpoint, x])).toEqual([
      ["base", 0],
      ["tablet", 1440 + FRAME_GAP],
      ["mobile", 1440 + FRAME_GAP + 768 + FRAME_GAP],
    ]);
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
