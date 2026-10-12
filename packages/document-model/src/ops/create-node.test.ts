import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { setupDoc } from "../../test/op-harness";
import { ID_PATTERN } from "../ids";
import { createNode } from "./create-node";
import { runOp } from "./op";

const imageProps = { fit: "cover", image: { assetId: "ast_cake000001", alt: "Kue" } };

describe("createNode", () => {
  it("membuat frame dengan default DM-027 di akhir children parent", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const result = runOp(ctx, createNode, { parentId: "n_hero000001", type: "frame" });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatch(ID_PATTERN);
    const doc = read();
    const hero = doc.nodes.n_hero000001;
    expect(hero && "children" in hero ? hero.children.at(-1) : undefined).toBe(result.value);
    expect(doc.nodes[result.value]).toMatchObject({
      type: "frame",
      name: "Frame",
      parentId: "n_hero000001",
      children: [],
      style: { base: { size: { width: { mode: "fill" }, height: { mode: "hug" } } } },
    });
  });

  it("menyisipkan di index tertentu dan memakai nama & style yang diberikan", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const result = runOp(ctx, createNode, {
      parentId: "n_hero000001",
      index: 0,
      type: "frame",
      name: "Kartu",
      style: { base: { fills: [{ type: "solid", color: "#FF5A1F" }] }, mobile: { fills: null } },
    });

    if (!result.ok) throw new Error(result.error.message);
    const node = read().nodes[result.value];
    expect(read().nodes.n_hero000001).toMatchObject({ children: [result.value, "n_herottl001", "n_heroimg001"] });
    expect(node?.name).toBe("Kartu");
    expect(node?.style.base).toMatchObject({ size: { width: { mode: "fill" } }, fills: [{ color: "#FF5A1F" }] });
    expect(node?.style.mobile).toEqual({ fills: null });
  });

  it("memberi text konten paragraf kosong secara default", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const result = runOp(ctx, createNode, { parentId: "n_hero000001", type: "text" });

    if (!result.ok) throw new Error(result.error.message);
    expect(read().nodes[result.value]).toMatchObject({
      props: { content: { type: "doc", content: [{ type: "paragraph" }] } },
    });
  });

  it("membuat image hanya jika props asset diberikan", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const withoutProps = runOp(ctx, createNode, { parentId: "n_hero000001", type: "image" });
    const withProps = runOp(ctx, createNode, { parentId: "n_hero000001", type: "image", props: imageProps });

    expect(withoutProps).toMatchObject({ ok: false, error: { code: "INVALID_RESULT" } });
    if (!withProps.ok) throw new Error(withProps.error.message);
    expect(read().nodes[withProps.value]).toMatchObject({
      style: { base: { size: { height: { mode: "fixed", value: 240, unit: "px" } } } },
    });
  });

  it("mengulang pembuatan ID jika bertabrakan dengan node yang ada (DM-007)", () => {
    const { ctx } = setupDoc(heroDocument());
    const ids = ["n_hero000001", "n_fresh00001"];
    ctx.idGen = () => ids.shift() ?? "n_fallback001";

    const result = runOp(ctx, createNode, { parentId: "n_hero000001", type: "frame" });

    expect(result).toMatchObject({ ok: true, value: "n_fresh00001" });
  });

  it.each([
    { name: "parent tidak ada", input: { parentId: "n_ghost00001", type: "frame" }, code: "NOT_FOUND" },
    { name: "parent bukan container", input: { parentId: "n_herottl001", type: "frame" }, code: "INVALID_TARGET" },
    { name: "tipe page", input: { parentId: "n_hero000001", type: "page" }, code: "INVALID_INPUT" },
    {
      name: "props tidak valid",
      input: { parentId: "n_hero000001", type: "frame", props: { role: "hero" } },
      code: "INVALID_RESULT",
    },
  ])("gagal tanpa perubahan saat $name", ({ input, code }) => {
    const { ctx, read } = setupDoc(heroDocument());

    expect(runOp(ctx, createNode, input)).toMatchObject({ ok: false, error: { code } });
    expect(read()).toEqual(heroDocument());
  });

  it("bisa di-undo dalam satu langkah", () => {
    const { ctx, read, undoManager } = setupDoc(heroDocument());

    runOp(ctx, createNode, { parentId: "n_hero000001", type: "text" });
    undoManager.undo();

    expect(read()).toEqual(heroDocument());
  });
});
