import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { runCommand } from "../commands/command";
import { updateStyle } from "../commands/update-style";
import type { ResponsiveStyle } from "../schema";
import { normalizeOverrides } from "./normalize-overrides";
import { resolveStyle } from "./resolve-style";

// T1.8.11: AC DM-036 — override yang sama dengan nilai warisan dihapus; patch kosong hilang.
const px = (value: number) => ({ value, unit: "px" as const });
const base: ResponsiveStyle["base"] = {
  layout: { mode: "flex", direction: "row", gap: px(32), padding: { top: px(16), left: px(16) } },
  size: { width: { mode: "fill" } },
  display: "auto",
};

const expectSameCascade = (before: ResponsiveStyle, after: ResponsiveStyle) => {
  for (const bp of ["base", "tablet", "mobile"] as const)
    expect(resolveStyle(after, bp)).toEqual(resolveStyle(before, bp));
};

describe("normalizeOverrides", () => {
  it("group yang identik dengan warisan dihapus; patch kosong → breakpoint hilang", () => {
    const style: ResponsiveStyle = { base, tablet: { size: { width: { mode: "fill" } }, display: "auto" }, mobile: {} };
    expect(normalizeOverrides(style)).toEqual({ base });
  });

  it("key redundan di dalam objek (termasuk sisi padding) dipangkas, yang beda dipertahankan", () => {
    const style: ResponsiveStyle = {
      base,
      tablet: { layout: { gap: px(32), direction: "column", padding: { top: px(16), left: px(8) } } },
    };
    const normalized = normalizeOverrides(style);
    expect(normalized.tablet).toEqual({ layout: { direction: "column", padding: { left: px(8) } } });
    expectSameCascade(style, normalized);
  });

  it("mobile dibandingkan dengan efektif tablet, bukan base", () => {
    const style: ResponsiveStyle = {
      base,
      tablet: { layout: { gap: px(24) } },
      mobile: { layout: { gap: px(24) }, display: "none" },
    };
    const normalized = normalizeOverrides(style);
    expect(normalized.mobile).toEqual({ display: "none" });
    expectSameCascade(style, normalized);
  });

  it("null tanpa nilai warisan redundan; null yang menghapus warisan dipertahankan", () => {
    const style: ResponsiveStyle = { base, tablet: { fills: null, size: { width: null } } };
    expect(normalizeOverrides(style).tablet).toEqual({ size: { width: null } });
  });

  it("layout dengan mode berbeda tidak dipangkas (replace utuh)", () => {
    const style: ResponsiveStyle = { base, mobile: { layout: { mode: "none" } } };
    expect(normalizeOverrides(style).mobile).toEqual({ layout: { mode: "none" } });
  });
});

describe("updateStyle menormalisasi override", () => {
  it("set tablet sama dengan base → tidak ada patch tablet", () => {
    const { ctx, read } = setupDoc(heroDocument());
    runCommand(ctx, updateStyle, {
      ids: ["n_hero000001"],
      breakpoint: "tablet",
      patch: { layout: { direction: "column" } },
    });
    expect(read().nodes.n_hero000001?.style.tablet).toBeUndefined();
  });

  it("base berubah menyamai override tablet → override tablet terhapus", () => {
    const { ctx, read } = setupDoc(heroDocument());
    runCommand(ctx, updateStyle, {
      ids: ["n_hero000001"],
      breakpoint: "tablet",
      patch: { display: "none", layout: { gap: px(4) } },
    });
    expect(read().nodes.n_hero000001?.style.tablet).toEqual({ display: "none", layout: { gap: px(4) } });

    runCommand(ctx, updateStyle, { ids: ["n_hero000001"], patch: { layout: { gap: px(4) } } });
    expect(read().nodes.n_hero000001?.style.tablet).toEqual({ display: "none" });
  });
});
