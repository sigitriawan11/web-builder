import { describe, expect, it } from "vitest";
import { TOOLS, toolDefinition } from "../../tools/tool-catalog";
import { effectiveTool, INITIAL_TOOL_STATE, toolReducer } from "../../tools/tool-store";
import { isCreatorTool } from "./creator-tools";

// T2.4.10 / ED-037: state tool pembuat node & "kembali ke Move setelah membuat".
describe("tool pembuat node (ED-037)", () => {
  it("tool creator dikenali; select & hand bukan creator", () => {
    expect(isCreatorTool("frame")).toBe(true);
    expect(isCreatorTool("section")).toBe(true);
    expect(isCreatorTool("rectangle")).toBe(true);
    expect(isCreatorTool("ellipse")).toBe(true);
    expect(isCreatorTool("text")).toBe(true);
    expect(isCreatorTool("select")).toBe(false);
    expect(isCreatorTool("hand")).toBe(false);
  });

  it("pilih tool creator lalu kembali ke Move (seperti setelah membuat node)", () => {
    const drawing = toolReducer(INITIAL_TOOL_STATE, { type: "selectTool", tool: "frame" });
    expect(effectiveTool(drawing)).toBe("frame");
    const afterCreate = toolReducer(drawing, { type: "selectTool", tool: "select" });
    expect(effectiveTool(afterCreate)).toBe("select");
  });

  it("setiap tool creator punya shortcut huruf tunggal di katalog", () => {
    for (const tool of ["frame", "section", "rectangle", "ellipse", "text", "icon"] as const) {
      expect(toolDefinition(tool).shortcuts.length).toBeGreaterThan(0);
    }
    // Shape dikelompokkan; semua tool terdaftar.
    expect(TOOLS.map((tool) => tool.id)).toEqual(
      expect.arrayContaining(["frame", "rectangle", "ellipse", "text", "icon"]),
    );
  });
});
