// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { chooseDropContainer, type FlexContainer, innerBandContains } from "./insert-drop";
import type { Rect } from "./reorder";

// T3.6.2/ED-170: logika murni pemilihan container drop (edge-band bubbling).
describe("insert-drop", () => {
  describe("innerBandContains", () => {
    const rect: Rect = { x: 0, y: 0, width: 400, height: 300 };
    it("column: pointer di tengah = dalam; dekat tepi atas/bawah = luar", () => {
      // band = clamp(300*0.25, 8, 48) = 48
      expect(innerBandContains(rect, { x: 200, y: 150 }, "column")).toBe(true);
      expect(innerBandContains(rect, { x: 200, y: 10 }, "column")).toBe(false);
      expect(innerBandContains(rect, { x: 200, y: 290 }, "column")).toBe(false);
    });
    it("row: pita tepi pada sumbu x", () => {
      // band = clamp(400*0.25, 8, 48) = 48
      expect(innerBandContains(rect, { x: 200, y: 150 }, "row")).toBe(true);
      expect(innerBandContains(rect, { x: 5, y: 150 }, "row")).toBe(false);
    });
  });

  describe("chooseDropContainer", () => {
    const chain: FlexContainer[] = [
      { id: "page", direction: "column", wrap: false },
      { id: "section", direction: "column", wrap: false },
    ];
    const rects: Record<string, Rect> = {
      page: { x: 0, y: 0, width: 400, height: 800 },
      section: { x: 0, y: 0, width: 400, height: 300 },
    };
    const rectOf = (id: string) => rects[id] ?? null;

    it("pointer di tengah section → turun ke section (sisip di dalam)", () => {
      expect(chooseDropContainer(chain, { x: 200, y: 150 }, rectOf)).toBe(1);
    });
    it("pointer dekat tepi section → berhenti di page (sisip antar section)", () => {
      expect(chooseDropContainer(chain, { x: 200, y: 8 }, rectOf)).toBe(0);
      expect(chooseDropContainer(chain, { x: 200, y: 295 }, rectOf)).toBe(0);
    });
    it("rect anak tak tersedia → tetap di parent", () => {
      expect(chooseDropContainer(chain, { x: 200, y: 150 }, () => null)).toBe(0);
    });
  });
});
