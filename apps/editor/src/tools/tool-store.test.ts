import { describe, expect, it } from "vitest";
import { createToolStore, effectiveTool, INITIAL_TOOL_STATE, type ToolAction, toolReducer } from "./tool-store";

const run = (...actions: ToolAction[]) => actions.reduce(toolReducer, INITIAL_TOOL_STATE);

describe("toolReducer", () => {
  it("dimulai dengan tool select tanpa tool sementara", () => {
    expect(INITIAL_TOOL_STATE).toEqual({ active: "select", temporary: null });
    expect(effectiveTool(INITIAL_TOOL_STATE)).toBe("select");
  });

  it("memilih hand tool secara permanen (H)", () => {
    const state = run({ type: "selectTool", tool: "hand" });

    expect(state).toEqual({ active: "hand", temporary: null });
    expect(effectiveTool(state)).toBe("hand");
  });

  it("tool sementara menang atas tool aktif selama ditahan, lalu kembali (Space)", () => {
    const holding = run({ type: "startTemporary", tool: "hand" });
    expect(effectiveTool(holding)).toBe("hand");
    expect(holding.active).toBe("select");

    const released = toolReducer(holding, { type: "endTemporary", tool: "hand" });
    expect(effectiveTool(released)).toBe("select");
  });

  it("melepas Space saat hand tool aktif tetap di hand tool", () => {
    const state = run(
      { type: "selectTool", tool: "hand" },
      { type: "startTemporary", tool: "hand" },
      { type: "endTemporary", tool: "hand" },
    );

    expect(effectiveTool(state)).toBe("hand");
  });

  it("memilih tool saat tool sementara ditahan berlaku setelah dilepas", () => {
    const holding = run({ type: "startTemporary", tool: "hand" }, { type: "selectTool", tool: "hand" });
    expect(effectiveTool(holding)).toBe("hand");

    const released = toolReducer(holding, { type: "endTemporary", tool: "hand" });
    expect(released).toEqual({ active: "hand", temporary: null });
  });

  it("mengabaikan key repeat dan pelepasan oleh tool yang bukan pemiliknya", () => {
    const holding = run({ type: "startTemporary", tool: "hand" });

    expect(toolReducer(holding, { type: "startTemporary", tool: "select" })).toBe(holding);
    expect(toolReducer(holding, { type: "endTemporary", tool: "select" })).toBe(holding);
    expect(toolReducer(INITIAL_TOOL_STATE, { type: "endTemporary", tool: "hand" })).toBe(INITIAL_TOOL_STATE);
  });

  it("memilih tool yang sudah aktif tidak membuat state baru", () => {
    expect(toolReducer(INITIAL_TOOL_STATE, { type: "selectTool", tool: "select" })).toBe(INITIAL_TOOL_STATE);
  });
});

describe("createToolStore", () => {
  it("dispatch menerapkan reducer dan hanya memberi notifikasi saat state berubah", () => {
    const store = createToolStore();
    let notifications = 0;
    store.subscribe(() => notifications++);

    store.getState().dispatch({ type: "startTemporary", tool: "hand" });
    store.getState().dispatch({ type: "startTemporary", tool: "hand" });
    store.getState().dispatch({ type: "endTemporary", tool: "hand" });

    expect(effectiveTool(store.getState())).toBe("select");
    expect(notifications).toBe(2);
  });
});
