import { describe, expect, it } from "vitest";
import { heroDocument, nestedDocument } from "../../test/fixtures/basic-documents";
import { setupDoc } from "../../test/op-harness";
import { runOp } from "./op";
import { updateStyle } from "./update-style";
import { nodesMap, styleOf } from "./y-access";

describe("updateStyle — aturan merge DM-036", () => {
  it("merge layout per field selama mode sama", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, { ids: ["n_hero000001"], patch: { layout: { gap: { value: 8, unit: "px" } } } });

    expect(read().nodes.n_hero000001?.style.base.layout).toMatchObject({
      mode: "flex",
      direction: "column",
      align: "center",
      gap: { value: 8, unit: "px" },
    });
  });

  it("merge padding per sisi", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, {
      ids: ["n_hero000001"],
      patch: { layout: { padding: { top: { value: 0, unit: "px" }, left: null } } },
    });

    expect(read().nodes.n_hero000001?.style.base.layout).toMatchObject({
      padding: {
        top: { value: 0, unit: "px" },
        right: { $token: "space.8" },
        bottom: { $token: "space.16" },
      },
    });
    const layout = read().nodes.n_hero000001?.style.base.layout;
    expect(layout?.mode === "flex" ? layout.padding : undefined).not.toHaveProperty("left");
  });

  it("mengganti layout utuh saat mode berubah", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, { ids: ["n_hero000001"], patch: { layout: { mode: "none" } } });

    expect(read().nodes.n_hero000001?.style.base.layout).toEqual({ mode: "none" });
  });

  it("mengganti array fills utuh dan menghapus group dengan null", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, {
      ids: ["n_hero000001"],
      patch: { fills: [{ type: "solid", color: "#000000" }], radius: null },
    });

    const base = read().nodes.n_hero000001?.style.base;
    expect(base?.fills).toEqual([{ type: "solid", color: "#000000" }]);
    expect(base).not.toHaveProperty("radius");
  });

  it("menulis ke patch breakpoint dan menghapus patch yang menjadi kosong", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, {
      ids: ["n_herottl001"],
      breakpoint: "tablet",
      patch: { size: { width: { mode: "fixed", value: 320, unit: "px" } } },
    });
    expect(read().nodes.n_herottl001?.style.tablet).toEqual({
      size: { width: { mode: "fixed", value: 320, unit: "px" } },
    });

    runOp(ctx, updateStyle, { ids: ["n_herottl001"], breakpoint: "tablet", patch: { size: { width: null } } });
    expect(read().nodes.n_herottl001?.style).not.toHaveProperty("tablet");
  });

  it("hanya menulis style group yang disentuh patch", () => {
    const { ctx, doc } = setupDoc(heroDocument());
    const yHero = nodesMap(doc).get("n_hero000001");
    if (!yHero) throw new Error("fixture berubah");
    const changedKeys: string[] = [];
    styleOf(yHero)
      .get("base")
      ?.observe((event) => changedKeys.push(...event.keysChanged));

    runOp(ctx, updateStyle, { ids: ["n_hero000001"], patch: { radius: { value: 0, unit: "px" } } });

    expect(changedKeys).toEqual(["radius"]);
  });

  it("menerapkan patch ke beberapa node sekaligus", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, { ids: ["n_hero000001", "n_heroimg001"], patch: { radius: { value: 2, unit: "px" } } });

    expect(read().nodes.n_hero000001?.style.base.radius).toEqual({ value: 2, unit: "px" });
    expect(read().nodes.n_heroimg001?.style.base.radius).toEqual({ value: 2, unit: "px" });
  });
});

describe("updateStyle — position (DM-028)", () => {
  it("type sama: merge per field; type berbeda: ganti utuh; null menghapus", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const position = () => read().nodes.n_heroimg001?.style.base.position;

    runOp(ctx, updateStyle, { ids: ["n_heroimg001"], patch: { position: { type: "absolute", x: 10, y: 20 } } });
    expect(position()).toEqual({ type: "absolute", x: 10, y: 20 });

    runOp(ctx, updateStyle, { ids: ["n_heroimg001"], patch: { position: { x: 35 } } });
    expect(position()).toEqual({ type: "absolute", x: 35, y: 20 });

    runOp(ctx, updateStyle, { ids: ["n_heroimg001"], patch: { position: { type: "flow" } } });
    expect(position()).toEqual({ type: "flow" });

    runOp(ctx, updateStyle, { ids: ["n_heroimg001"], patch: { position: null } });
    expect(read().nodes.n_heroimg001?.style.base).not.toHaveProperty("position");
  });

  it("absolute tanpa x/y ditolak", () => {
    const { ctx, read } = setupDoc(heroDocument());

    expect(runOp(ctx, updateStyle, { ids: ["n_heroimg001"], patch: { position: { type: "absolute" } } })).toMatchObject(
      {
        ok: false,
        error: { code: "INVALID_RESULT" },
      },
    );
    expect(read()).toEqual(heroDocument());
  });
});

describe("updateStyle — gagal tanpa perubahan", () => {
  it.each([
    {
      name: "hasil base tidak valid (layout tanpa mode)",
      input: { ids: ["n_herottl001"], patch: { layout: { gap: { value: 4, unit: "px" } } } },
      code: "INVALID_RESULT",
    },
    {
      name: "image memakai hug (DM-027)",
      input: { ids: ["n_heroimg001"], breakpoint: "mobile", patch: { size: { height: { mode: "hug" } } } },
      code: "INVALID_RESULT",
    },
    {
      name: "salah satu node tidak ada",
      input: { ids: ["n_hero000001", "n_ghost00001"], patch: { radius: { value: 2, unit: "px" } } },
      code: "NOT_FOUND",
    },
    {
      name: "patch berisi key tak dikenal",
      input: { ids: ["n_hero000001"], patch: { customCss: "color: red" } },
      code: "INVALID_INPUT",
    },
  ])("$name", ({ input, code }) => {
    const { ctx, read } = setupDoc(heroDocument());

    expect(runOp(ctx, updateStyle, input)).toMatchObject({ ok: false, error: { code } });
    expect(read()).toEqual(heroDocument());
  });
});

describe("updateStyle — undo", () => {
  it("bisa di-undo dalam satu langkah, termasuk patch breakpoint yang dihapus", () => {
    const { ctx, read, undoManager } = setupDoc(nestedDocument());

    runOp(ctx, updateStyle, {
      ids: ["n_lvl1000001"],
      breakpoint: "tablet",
      patch: { layout: null },
    });
    expect(read().nodes.n_lvl1000001?.style).not.toHaveProperty("tablet");
    undoManager.undo();

    expect(read()).toEqual(nestedDocument());
  });
});
