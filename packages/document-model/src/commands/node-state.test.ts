import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { minimalDocument } from "../../test/fixtures/basic-documents";
import { runCommand } from "./command";
import { createNode } from "./create-node";
import { clearNodeState, setNodeState } from "./node-state";

describe("setNodeState / clearNodeState (CMP-032)", () => {
  function frame() {
    const h = setupDoc(minimalDocument());
    const home = h.read().pageOrder[0] as string;
    const created = runCommand(h.ctx, createNode, { parentId: home, type: "frame", name: "Btn" });
    if (!created.ok) throw new Error(created.error.code);
    return { ...h, id: created.value };
  }

  const hoverOpacity = (h: ReturnType<typeof frame>): unknown => {
    const node = h.read().nodes[h.id];
    const base = node?.style.states?.hover?.base as { opacity?: unknown } | undefined;
    return base?.opacity;
  };

  it("set style state hover (round-trip); node tak ada → NOT_FOUND", () => {
    const h = frame();
    const r = runCommand(h.ctx, setNodeState, { id: h.id, state: "hover", patch: { opacity: 0.5 } });
    expect(r.ok).toBe(true);
    expect(hoverOpacity(h)).toBe(0.5);

    const miss = runCommand(h.ctx, setNodeState, { id: "n_ghost0001", state: "hover", patch: { opacity: 0.2 } });
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error.code).toBe("NOT_FOUND");
  });

  it("merge group & hapus group dengan null", () => {
    const h = frame();
    runCommand(h.ctx, setNodeState, { id: h.id, state: "hover", patch: { opacity: 0.5 } });
    runCommand(h.ctx, setNodeState, { id: h.id, state: "hover", patch: { opacity: null } });
    expect(hoverOpacity(h)).toBeUndefined();
  });

  it("clearNodeState menghapus state penuh", () => {
    const h = frame();
    runCommand(h.ctx, setNodeState, { id: h.id, state: "focus", patch: { opacity: 0.8 } });
    const c = runCommand(h.ctx, clearNodeState, { id: h.id, state: "focus" });
    expect(c.ok).toBe(true);
    expect(h.read().nodes[h.id]?.style.states).toBeUndefined();
  });
});
