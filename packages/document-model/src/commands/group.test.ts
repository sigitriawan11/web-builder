import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument } from "../../test/fixtures/basic-documents";
import type { SiteDocument } from "../schema";
import { runCommand } from "./command";
import { createNode } from "./create-node";
import { groupNodes, ungroup } from "./group";

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

describe("groupNodes / ungroup (ED-144/145, DM-012)", () => {
  it("group: node absolute (parent sama) → node group di bbox; anak absolute relatif ke group", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const a = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(100, 50) });
    const b = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(200, 120) });
    if (!a.ok || !b.ok) throw new Error("setup gagal");

    const result = runCommand(ctx, groupNodes, {
      ids: [a.value, b.value],
      rect: { x: 100, y: 50, width: 180, height: 110 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const groupId = result.value;
    const doc = read();

    expect(doc.nodes[groupId]?.type).toBe("group");
    expect(childrenOf(doc, groupId)).toEqual([a.value, b.value]);
    expect(doc.nodes[a.value]?.parentId).toBe(groupId);
    // Posisi relatif ke group: a (100,50) → (0,0); b (200,120) → (100,70).
    expect(doc.nodes[a.value]?.style.base.position).toMatchObject({ type: "absolute", x: 0, y: 0 });
    expect(doc.nodes[b.value]?.style.base.position).toMatchObject({ type: "absolute", x: 100, y: 70 });
    // Group menggantikan posisi node pertama di page; size = bbox.
    expect(childrenOf(doc, "pg_home000001")).toContain(groupId);
    expect(childrenOf(doc, "pg_home000001")).not.toContain(a.value);
    expect(doc.nodes[groupId]?.style.base.size).toMatchObject({
      width: { mode: "fixed", value: 180 },
      height: { mode: "fixed", value: 110 },
    });
  });

  it("group lalu ungroup mengembalikan anak ke page di indeks group, posisi visual tetap, group dihapus (AC)", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const a = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(100, 50) });
    const b = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(200, 120) });
    if (!a.ok || !b.ok) throw new Error("setup gagal");
    const before = childrenOf(read(), "pg_home000001");
    const groupIndex = before?.indexOf(a.value) ?? -1;

    const grouped = runCommand(ctx, groupNodes, {
      ids: [a.value, b.value],
      rect: { x: 100, y: 50, width: 180, height: 110 },
    });
    if (!grouped.ok) throw new Error("group gagal");

    const result = runCommand(ctx, ungroup, { id: grouped.value });
    expect(result.ok).toBe(true);
    const doc = read();

    // Group dihapus; anak kembali ke page.
    expect(doc.nodes[grouped.value]).toBeUndefined();
    expect(doc.nodes[a.value]?.parentId).toBe("pg_home000001");
    // Posisi visual dipertahankan (kembali ke absolut semula).
    expect(doc.nodes[a.value]?.style.base.position).toMatchObject({ type: "absolute", x: 100, y: 50 });
    expect(doc.nodes[b.value]?.style.base.position).toMatchObject({ type: "absolute", x: 200, y: 120 });
    // Anak disisipkan pada indeks group.
    const after = childrenOf(doc, "pg_home000001");
    expect(after?.[groupIndex]).toBe(a.value);
    expect(after?.[groupIndex + 1]).toBe(b.value);
  });

  it("menolak node dengan parent berbeda", () => {
    const { ctx } = setupDoc(heroDocument());
    const a = runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", style: absolute(0, 0) });
    if (!a.ok) throw new Error("setup gagal");
    const result = runCommand(ctx, groupNodes, {
      ids: [a.value, "n_herottl001"], // beda parent (title ada di hero section)
      rect: { x: 0, y: 0, width: 10, height: 10 },
    });
    expect(result.ok).toBe(false);
  });
});
