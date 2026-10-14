import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { runCommand } from "./command";
import { clearBreakpointOverrides, setBreakpointOverride, setLayoutMode, setSettings } from "./style-commands";
import { updateStyle } from "./update-style";

// T1.9.6: command style & layout (DM-074, DM-036).
const px = (value: number) => ({ value, unit: "px" as const });

// Hero tanpa override bawaan fixture agar isi patch bisa dibandingkan persis.
function plainHero() {
  const doc = heroDocument();
  for (const node of Object.values(doc.nodes)) {
    delete node.style.tablet;
    delete node.style.mobile;
  }
  return doc;
}

describe("setBreakpointOverride (patch sparse)", () => {
  it("menulis hanya field yang berbeda; null kembali mewarisi; nilai sama dengan warisan tidak disimpan", () => {
    const { ctx, read } = setupDoc(plainHero());
    expect(
      runCommand(ctx, setBreakpointOverride, {
        id: "n_hero000001",
        breakpoint: "mobile",
        patch: { layout: { gap: px(8) } },
      }).ok,
    ).toBe(true);
    expect(read().nodes.n_hero000001?.style.mobile).toEqual({ layout: { gap: px(8) } });

    runCommand(ctx, setBreakpointOverride, {
      id: "n_hero000001",
      breakpoint: "mobile",
      patch: { layout: { direction: "column" } },
    });
    // `direction: column` sama dengan base → dibuang normalisasi; gap tetap.
    expect(read().nodes.n_hero000001?.style.mobile).toEqual({ layout: { gap: px(8) } });

    runCommand(ctx, setBreakpointOverride, {
      id: "n_hero000001",
      breakpoint: "mobile",
      patch: { layout: { gap: null } },
    });
    expect(read().nodes.n_hero000001?.style.mobile).toBeUndefined();
  });

  it("base tidak bisa dipakai sebagai override", () => {
    const { ctx } = setupDoc(plainHero());
    expect(runCommand(ctx, setBreakpointOverride, { id: "n_hero000001", breakpoint: "base", patch: {} })).toMatchObject(
      {
        error: { code: "INVALID_INPUT" },
      },
    );
  });
});

describe("setLayoutMode", () => {
  it("mengganti layout utuh (field mode lama tidak terbawa)", () => {
    const { ctx, read } = setupDoc(plainHero());
    expect(runCommand(ctx, setLayoutMode, { id: "n_hero000001", layout: { mode: "flex", direction: "row" } }).ok).toBe(
      true,
    );
    expect(read().nodes.n_hero000001?.style.base.layout).toEqual({ mode: "flex", direction: "row" });
    runCommand(ctx, setLayoutMode, { id: "n_hero000001", layout: { mode: "none" }, breakpoint: "mobile" });
    expect(read().nodes.n_hero000001?.style.mobile).toEqual({ layout: { mode: "none" } });
  });

  it.each([
    ["node non-container", "n_herottl001", { mode: "flex", direction: "row" }],
    ["page selain flex kolom (DM-010)", "pg_home000001", { mode: "flex", direction: "row" }],
    ["page layout none", "pg_home000001", { mode: "none" }],
  ])("%s ditolak tanpa perubahan", (_, id, layout) => {
    const { ctx, read } = setupDoc(plainHero());
    expect(runCommand(ctx, setLayoutMode, { id, layout })).toMatchObject({ ok: false });
    expect(read()).toEqual(plainHero());
  });

  it("updateStyle juga menolak layout page baris (celah sebelumnya)", () => {
    const { ctx, read } = setupDoc(plainHero());
    expect(
      runCommand(ctx, updateStyle, {
        ids: ["pg_home000001"],
        breakpoint: "mobile",
        patch: { layout: { direction: "row" } },
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_RESULT", details: { invariant: "PAGE_LAYOUT" } } });
    expect(read()).toEqual(plainHero());
  });
});

describe("clearBreakpointOverrides", () => {
  function withOverrides() {
    const setup = setupDoc(plainHero());
    const { ctx } = setup;
    runCommand(ctx, setBreakpointOverride, {
      id: "n_hero000001",
      breakpoint: "tablet",
      patch: { layout: { gap: px(12) }, radius: px(4) },
    });
    runCommand(ctx, setBreakpointOverride, {
      id: "n_hero000001",
      breakpoint: "mobile",
      patch: { layout: { gap: px(8), align: "start" } },
    });
    runCommand(ctx, setBreakpointOverride, { id: "n_herottl001", breakpoint: "mobile", patch: { display: "none" } });
    return setup;
  }

  it("per field (grup & grup.key) di satu breakpoint", () => {
    const { ctx, read } = withOverrides();
    const result = runCommand(ctx, clearBreakpointOverrides, {
      ids: ["n_hero000001"],
      breakpoint: "mobile",
      fields: ["layout.gap"],
    });
    expect(result).toMatchObject({ ok: true, value: { cleared: 1 } });
    expect(read().nodes.n_hero000001?.style.mobile).toEqual({ layout: { align: "start" } });
    runCommand(ctx, clearBreakpointOverrides, { ids: ["n_hero000001"], fields: ["radius"] });
    expect(read().nodes.n_hero000001?.style.tablet).toEqual({ layout: { gap: px(12) } });
  });

  it("tanpa ids = semua node; tanpa breakpoint = tablet & mobile; base tidak tersentuh", () => {
    const { ctx, read } = withOverrides();
    const base = read().nodes.n_hero000001?.style.base;
    expect(runCommand(ctx, clearBreakpointOverrides, {})).toMatchObject({ ok: true, value: { cleared: 2 } });
    const doc = read();
    for (const node of Object.values(doc.nodes)) {
      expect(node.style.tablet).toBeUndefined();
      expect(node.style.mobile).toBeUndefined();
    }
    expect(doc.nodes.n_hero000001?.style.base).toEqual(base);
  });
});

describe("setSettings", () => {
  it("merge per key, hanya key yang berubah ditulis; tervalidasi schema", () => {
    const { ctx, doc, read } = setupDoc(plainHero());
    const changes: string[] = [];
    doc.getMap("settings").observe((event) => changes.push(...event.keysChanged));
    const result = runCommand(ctx, setSettings, {
      patch: { manualResponsive: true, language: heroDocument().settings.language },
    });
    expect(result).toMatchObject({ ok: true, value: { changed: ["manualResponsive"] } });
    expect(changes).toEqual(["manualResponsive"]);
    expect(read().settings.manualResponsive).toBe(true);
  });

  it.each([
    ["key tak dikenal", { customCss: "x" }],
    ["urutan breakpoint terbalik", { breakpoints: [] }],
    ["bahasa tidak valid", { language: 42 }],
  ])("%s ditolak tanpa perubahan", (_, patch) => {
    const { ctx, read } = setupDoc(plainHero());
    expect(runCommand(ctx, setSettings, { patch })).toMatchObject({ ok: false, error: { code: "INVALID_RESULT" } });
    expect(read()).toEqual(plainHero());
  });
});
