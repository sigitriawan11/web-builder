import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { z } from "zod";
import { setupDoc } from "../../test/command-harness";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { YDOC_KEYS } from "../yjs/mapping";
import { defineCommand, fail, runCommand, runCommands, step } from "./command";
import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { COMMANDS } from "./index";
import { moveNode } from "./move-node";
import { updateStyle } from "./update-style";

describe("runCommand", () => {
  it("menjalankan op dalam satu transaksi dengan origin dari context", () => {
    const { ctx, doc } = setupDoc(heroDocument());
    const origins: unknown[] = [];
    doc.on("afterTransaction", (transaction) => origins.push(transaction.origin));

    runCommand(ctx, deleteNodes, { ids: ["n_hero000001"] });

    expect(origins).toEqual([ctx.origin]);
  });

  it.each([
    {
      name: "createNode",
      run: (ctx: Parameters<typeof runCommand>[0]) =>
        runCommand(ctx, createNode, { parentId: "n_herottl001", type: "frame" }),
    },
    {
      name: "moveNode",
      run: (ctx: Parameters<typeof runCommand>[0]) =>
        runCommand(ctx, moveNode, { id: "n_hero000001", newParentId: "n_herottl001", index: 0 }),
    },
    {
      name: "updateStyle",
      run: (ctx: Parameters<typeof runCommand>[0]) =>
        runCommand(ctx, updateStyle, { ids: ["n_hero000001", "n_ghost00001"], patch: { radius: null } }),
    },
    {
      name: "deleteNodes",
      run: (ctx: Parameters<typeof runCommand>[0]) =>
        runCommand(ctx, deleteNodes, { ids: ["n_hero000001", "n_ghost00001"] }),
    },
  ])("$name yang gagal tidak menghasilkan update Yjs sama sekali", ({ run }) => {
    const { ctx, doc } = setupDoc(heroDocument());
    let updates = 0;
    doc.on("update", () => updates++);

    expect(run(ctx).ok).toBe(false);
    expect(updates).toBe(0);
  });

  it("tiap op adalah satu langkah undo terpisah", () => {
    const { ctx, read, undoManager } = setupDoc(heroDocument());

    runCommand(ctx, updateStyle, { ids: ["n_hero000001"], patch: { radius: null } });
    const afterFirst = read();
    runCommand(ctx, moveNode, { id: "n_heroimg001", newParentId: "pg_home000001", index: 0 });

    undoManager.undo();
    expect(read()).toEqual(afterFirst);
    undoManager.undo();
    expect(read()).toEqual(heroDocument());
  });
});

// T1.9.4: kerangka command API (DM-073).
describe("registry & kontrak command", () => {
  it.each(Object.entries(COMMANDS))("%s: Zod input, deskripsi dwibahasa, aiExposed", (name, def) => {
    expect(def.name).toBe(name);
    expect(def.input).toBeInstanceOf(z.ZodType);
    expect(def.description.id.length).toBeGreaterThan(10);
    expect(def.description.en.length).toBeGreaterThan(10);
    expect(typeof def.aiExposed).toBe("boolean");
  });

  it("input tidak valid → INVALID_INPUT dwibahasa dengan path, dokumen tidak berubah", () => {
    const { ctx, doc } = setupDoc(heroDocument());
    let updates = 0;
    doc.on("update", () => updates++);
    const result = runCommand(ctx, moveNode, { id: "n_hero000001", newParentId: "pg_home000001", index: -1 });
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_INPUT", path: ["index"] } });
    if (result.ok) throw new Error("harus gagal");
    expect(result.error.message.id).toMatch(/^moveNode: /);
    expect(result.error.message.en).toMatch(/^moveNode: invalid input/);
    expect(updates).toBe(0);
  });
});

describe("runCommands (batch atomik)", () => {
  it("error di tengah batch → dokumen asli tidak berubah sama sekali (AC DM-073)", () => {
    const { ctx, doc, read } = setupDoc(heroDocument());
    let updates = 0;
    doc.on("update", () => updates++);
    const result = runCommands(ctx, [
      step(createNode, { parentId: "n_hero000001", type: "frame", name: "A" }),
      step(updateStyle, { ids: ["n_hero000001"], patch: { radius: { value: 4, unit: "px" } } }),
      step(moveNode, { id: "n_herottl001", newParentId: "n_tidakada001", index: 0 }),
      step(createNode, { parentId: "n_hero000001", type: "frame", name: "B" }),
    ]);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", details: { step: 2, command: "moveNode" } },
    });
    expect(updates).toBe(0);
    expect(read()).toEqual(heroDocument());
  });

  it("berhasil → satu transaksi ber-origin, satu langkah undo; langkah berikutnya melihat hasil sebelumnya", () => {
    const { ctx, doc, read, undoManager } = setupDoc(heroDocument());
    const origins: unknown[] = [];
    doc.on("afterTransaction", (transaction) => origins.push(transaction.origin));

    const result = runCommands(ctx, (results) => {
      if (results.length === 0) return step(createNode, { parentId: "pg_home000001", type: "frame", name: "Wadah" });
      if (results.length === 1) {
        return step(moveNode, { id: "n_herottl001", newParentId: String(results[0]), index: 0 });
      }
      return null;
    });
    if (!result.ok) throw new Error(result.error.message.id);
    const [wrapperId] = result.value;
    expect(origins).toEqual([ctx.origin]);
    expect(read().nodes.n_herottl001?.parentId).toBe(wrapperId);
    expect(result.affected).toEqual(expect.arrayContaining([String(wrapperId), "n_herottl001"]));

    undoManager.undo();
    expect(read()).toEqual(heroDocument());
  });
});

describe("normalize & pasca-cek", () => {
  const writeRaw = defineCommand({
    name: "writeRaw",
    description: { id: "Test: tulis nilai mentah ke node", en: "Test: write a raw value to a node" },
    aiExposed: false,
    input: z.strictObject({ id: z.string(), key: z.string(), value: z.unknown() }),
    run(ctx, input) {
      const yNode = ctx.doc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes).get(input.id);
      if (!yNode) return fail("NOT_FOUND", { id: "tidak ada", en: "missing" });
      if (input.key === "tablet") {
        (yNode.get("style") as Y.Map<unknown>).set("tablet", new Y.Map(Object.entries(input.value as object)));
      } else yNode.set(input.key, input.value);
      return { ok: true, value: undefined, affected: [input.id] };
    },
  });

  it("override tablet yang sama dengan base dibuang oleh runner (DM-036)", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const base = read().nodes.n_hero000001?.style.base;
    const result = runCommand(ctx, writeRaw, { id: "n_hero000001", key: "tablet", value: { size: base?.size } });
    expect(result.ok).toBe(true);
    expect(read().nodes.n_hero000001?.style.tablet).toBeUndefined();
  });

  it("command yang merusak relasi parent → INVARIANT_VIOLATION dengan pesan informatif", () => {
    const { ctx } = setupDoc(heroDocument());
    const result = runCommand(ctx, writeRaw, { id: "n_herottl001", key: "parentId", value: "pg_home000001" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVARIANT_VIOLATION", details: { command: "writeRaw" } },
    });
    if (result.ok) throw new Error("harus gagal");
    expect(result.error.message.en).toMatch(/writeRaw produced an invalid document/);
  });
});
