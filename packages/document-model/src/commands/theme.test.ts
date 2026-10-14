import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { richTextDocument } from "../../test/fixtures/basic-documents";
import { validateDocument } from "../validate/validate-document";
import { YDOC_KEYS } from "../yjs/mapping";
import { runCommand } from "./command";
import { addFont, deleteToken, renameToken, setToken } from "./theme";
import { updateStyle } from "./update-style";

// T1.9.8: command theme (DM-074, DM-042).
const HOME = "pg_home000001";
const TEXT = "n_richtext001";

/** Dokumen dengan rujukan `color.primary` di: mark rich text, fill page, fill alpha, dan alias theme. */
function setup() {
  const setup = setupDoc(richTextDocument());
  const { ctx } = setup;
  runCommand(ctx, updateStyle, {
    ids: [HOME],
    patch: {
      fills: [
        { type: "solid", color: { $token: "color.primary" } },
        { type: "solid", color: { $token: "color.primary", alpha: 0.5 } },
      ],
    },
  });
  runCommand(ctx, setToken, { path: "color.primaryHover", value: { $token: "color.primary" } });
  return setup;
}

const markColor = (doc: ReturnType<ReturnType<typeof setup>["read"]>) => {
  const node = doc.nodes[TEXT];
  const [paragraph] = node?.type === "text" ? node.props.content.content : [];
  const bold = paragraph && "content" in paragraph ? paragraph.content?.[1] : undefined;
  return bold && "marks" in bold ? bold.marks?.find((mark) => mark.type === "textStyle") : undefined;
};

describe("renameToken (jumlah ref ter-update)", () => {
  it("memperbarui rujukan di style, alpha, mark rich text, dan alias theme; satu langkah undo", () => {
    const { ctx, read, undoManager } = setup();
    const before = read();
    const result = runCommand(ctx, renameToken, { from: "color.primary", to: "color.utama" });
    expect(result).toMatchObject({ ok: true, value: { updatedRefs: 4 } });

    const doc = read();
    expect(doc.theme.tokens.color.utama).toBe(before.theme.tokens.color.primary);
    expect(doc.theme.tokens.color.primary).toBeUndefined();
    expect(doc.theme.tokens.color.primaryHover).toEqual({ $token: "color.utama" });
    expect(doc.nodes[HOME]?.style.base.fills).toEqual([
      { type: "solid", color: { $token: "color.utama" } },
      { type: "solid", color: { $token: "color.utama", alpha: 0.5 } },
    ]);
    expect(markColor(doc)).toEqual({ type: "textStyle", attrs: { color: { $token: "color.utama" } } });
    expect(validateDocument(doc, { mode: "publish" }).errors).toEqual([]);

    undoManager.undo();
    expect(read()).toEqual(before);
  });

  it("alias pendek `type.*` ikut cocok; rename lintas grup & ke nama yang ada ditolak", () => {
    const { ctx, read } = setup();
    runCommand(ctx, updateStyle, { ids: [TEXT], patch: { typography: { $token: "type.h1" } } });
    expect(runCommand(ctx, renameToken, { from: "typography.h1", to: "type.judul" })).toMatchObject({
      value: { updatedRefs: 1 },
    });
    expect(read().nodes[TEXT]?.style.base.typography).toEqual({ $token: "typography.judul" });

    expect(runCommand(ctx, renameToken, { from: "color.accent", to: "space.accent" })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(runCommand(ctx, renameToken, { from: "color.accent", to: "color.danger" })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(runCommand(ctx, renameToken, { from: "color.tidakAda", to: "color.x" })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("deleteToken (replaceWith)", () => {
  it("diganti token lain: alpha dipertahankan; jumlah ref dilaporkan", () => {
    const { ctx, read } = setup();
    const result = runCommand(ctx, deleteToken, { path: "color.primary", replaceWith: { $token: "color.accent" } });
    expect(result).toMatchObject({ ok: true, value: { updatedRefs: 4 } });
    const doc = read();
    expect(doc.theme.tokens.color.primary).toBeUndefined();
    expect(doc.nodes[HOME]?.style.base.fills?.[1]).toEqual({
      type: "solid",
      color: { $token: "color.accent", alpha: 0.5 },
    });
    expect(validateDocument(doc, { mode: "publish" }).errors).toEqual([]);
  });

  it("diganti literal: { $token, alpha } menjadi hex + alpha", () => {
    const { ctx, read } = setup();
    expect(runCommand(ctx, deleteToken, { path: "color.primary", replaceWith: "#112233" }).ok).toBe(true);
    const doc = read();
    expect(doc.nodes[HOME]?.style.base.fills).toEqual([
      { type: "solid", color: "#112233" },
      { type: "solid", color: "#11223380" },
    ]);
    expect(doc.theme.tokens.color.primaryHover).toBe("#112233");
    expect(markColor(doc)).toEqual({ type: "textStyle", attrs: { color: "#112233" } });
  });

  it("pengganti tidak cocok tipe / token sendiri / tanpa pengganti → ditolak tanpa perubahan", () => {
    const { ctx, read } = setup();
    const before = read();
    for (const replaceWith of [{ value: 4, unit: "px" }, { $token: "color.primary" }, null]) {
      expect(
        runCommand(ctx, deleteToken, { path: "color.primary", replaceWith }),
        JSON.stringify(replaceWith),
      ).toMatchObject({ ok: false });
    }
    expect(read()).toEqual(before);
  });
});

describe("setToken & addFont", () => {
  it("membuat literal, alias, token bersarang & responsif; nilai salah ditolak", () => {
    const { ctx, read } = setup();
    expect(runCommand(ctx, setToken, { path: "color.brand.600", value: "#9A3412" }).ok).toBe(true);
    expect(
      runCommand(ctx, setToken, {
        path: "space.gutter",
        value: { value: { value: 32, unit: "px" }, mobile: { value: 16, unit: "px" } },
      }).ok,
    ).toBe(true);
    expect(read().theme.tokens.color.brand).toEqual({ 600: "#9A3412" });
    expect(runCommand(ctx, setToken, { path: "color.x", value: "red" })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(runCommand(ctx, setToken, { path: "color.brand", value: "#000000" })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
    expect(runCommand(ctx, setToken, { path: "unknown.x", value: "#000000" })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
  });

  it("alias yang membentuk siklus atau font yang tidak terdaftar ditolak", () => {
    const { ctx, read } = setup();
    const before = read();
    expect(runCommand(ctx, setToken, { path: "color.primary", value: { $token: "color.primaryHover" } })).toMatchObject(
      {
        error: { code: "INVALID_RESULT", message: { en: expect.stringContaining("cycle") } },
      },
    );
    expect(runCommand(ctx, setToken, { path: "fontFamily.body", value: "Comic Sans MS" })).toMatchObject({
      error: { code: "INVALID_RESULT" },
    });
    expect(read()).toEqual(before);
  });

  it("addFont: family unik, upload wajib asset terdaftar; setelah ditambah bisa dipakai token", () => {
    const { ctx, doc } = setup();
    expect(
      runCommand(ctx, addFont, { family: "inter", source: "google", weights: [400], fallback: "sans-serif" }),
    ).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    const upload = {
      family: "Brand Sans",
      source: "upload",
      assetId: "ast_font000001",
      weights: [400],
      fallback: "sans-serif",
    };
    expect(runCommand(ctx, addFont, upload)).toMatchObject({ error: { code: "NOT_FOUND" } });
    doc.getMap(YDOC_KEYS.assets).set("ast_font000001", { kind: "font", mime: "font/woff2" });
    expect(runCommand(ctx, addFont, upload).ok).toBe(true);
    expect(runCommand(ctx, setToken, { path: "fontFamily.body", value: "Brand Sans" }).ok).toBe(true);
  });
});
