import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument } from "../../test/fixtures/basic-documents";
import type { SiteDocument } from "../schema";
import { runCommand } from "./command";
import { createNode } from "./create-node";
import { wrapInFrame } from "./wrap-in-frame";

function childrenOf(doc: SiteDocument, id: string): string[] | undefined {
  const node = doc.nodes[id];
  return node && "children" in node ? node.children : undefined;
}

const absolute = (x: number, y: number) => ({
  base: {
    position: { type: "absolute" as const, x, y },
    size: {
      width: { mode: "fixed" as const, value: 80, unit: "px" as const },
      height: { mode: "fixed" as const, value: 40, unit: "px" as const },
    },
  },
});

describe("wrapInFrame (ED-146)", () => {
  it("membungkus node absolute (parent sama) dalam frame freeform; posisi jadi relatif ke frame", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const a = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(100, 50) });
    const b = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(200, 120) });
    if (!a.ok || !b.ok) throw new Error("setup gagal");

    const result = runCommand(ctx, wrapInFrame, {
      ids: [a.value, b.value],
      rect: { x: 100, y: 50, width: 180, height: 110 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const frameId = result.value;
    const doc = read();

    expect(childrenOf(doc, frameId)).toEqual([a.value, b.value]);
    expect(doc.nodes[a.value]?.parentId).toBe(frameId);
    // Posisi relatif: a (100,50) di frame (100,50) → (0,0); b (200,120) → (100,70).
    expect(doc.nodes[a.value]?.style.base.position).toMatchObject({ type: "absolute", x: 0, y: 0 });
    expect(doc.nodes[b.value]?.style.base.position).toMatchObject({ type: "absolute", x: 100, y: 70 });
    // Frame menggantikan posisi node pertama di page; node asli keluar dari page.
    expect(childrenOf(doc, "pg_home000001")).toContain(frameId);
    expect(childrenOf(doc, "pg_home000001")).not.toContain(a.value);
    expect(doc.nodes[frameId]?.style.base.size?.width).toMatchObject({ mode: "fixed", value: 180 });
  });

  it("tanpa rect → frame Hug (untuk parent auto-layout)", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const a = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(10, 10) });
    if (!a.ok) throw new Error("setup gagal");
    const result = runCommand(ctx, wrapInFrame, { ids: [a.value] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(read().nodes[result.value]?.style.base.size).toMatchObject({
      width: { mode: "hug" },
      height: { mode: "hug" },
    });
  });

  it("menolak node dengan parent berbeda (AC ED-146)", () => {
    const { ctx } = setupDoc(heroDocument());
    // n_herottl001 parent = n_hero000001; n_hero000001 parent = page → berbeda.
    const result = runCommand(ctx, wrapInFrame, { ids: ["n_herottl001", "n_hero000001"] });
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  });
});
