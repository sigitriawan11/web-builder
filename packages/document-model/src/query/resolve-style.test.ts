import { describe, expect, it } from "vitest";
import type { ResponsiveStyle } from "../schema";
import { applyStylePatch, createStyleResolver, resolveStyle } from "./resolve-style";

const px = (value: number) => ({ value, unit: "px" as const });

// Contoh persis dari DM-036.
const dm036: ResponsiveStyle = {
  base: { layout: { mode: "flex", direction: "row", gap: px(32) }, size: { width: { mode: "fill" } } },
  tablet: { layout: { gap: px(24) } },
  mobile: { layout: { direction: "column" } },
};

describe("resolveStyle (DM-036)", () => {
  it("base dikembalikan apa adanya", () => {
    expect(resolveStyle(dm036, "base")).toBe(dm036.base);
  });

  it("tablet = base + patch tablet", () => {
    expect(resolveStyle(dm036, "tablet")).toEqual({
      layout: { mode: "flex", direction: "row", gap: px(24) },
      size: { width: { mode: "fill" } },
    });
  });

  it("mobile mewarisi tablet lalu patch mobile (contoh DM-036: flex, column, gap 24px, width fill)", () => {
    expect(resolveStyle(dm036, "mobile")).toEqual({
      layout: { mode: "flex", direction: "column", gap: px(24) },
      size: { width: { mode: "fill" } },
    });
  });

  it("null di patch menghapus nilai warisan, array diganti utuh", () => {
    const style: ResponsiveStyle = {
      base: { fills: [{ type: "solid", color: "#111111" }], radius: px(8) },
      mobile: { fills: [{ type: "solid", color: "#222222" }], radius: null },
    };

    expect(resolveStyle(style, "tablet")).toEqual(style.base);
    expect(resolveStyle(style, "mobile")).toEqual({ fills: [{ type: "solid", color: "#222222" }] });
  });

  it("mode layout berbeda di patch mengganti layout utuh", () => {
    const style: ResponsiveStyle = {
      base: { layout: { mode: "flex", direction: "row", gap: px(8) } },
      tablet: { layout: { mode: "none" } },
    };

    expect(resolveStyle(style, "tablet")).toEqual({ layout: { mode: "none" } });
  });

  it("patch yang menghasilkan style tidak valid jatuh ke base", () => {
    const style: ResponsiveStyle = {
      base: { layout: { mode: "none" } },
      mobile: { layout: { mode: "flex" } },
    };

    expect(resolveStyle(style, "mobile")).toBe(style.base);
  });

  it("tidak mengubah objek style asli", () => {
    const snapshot = JSON.stringify(dm036);
    resolveStyle(dm036, "mobile");
    expect(JSON.stringify(dm036)).toBe(snapshot);
  });
});

describe("applyStylePatch", () => {
  it("merge per aturan DM-036 dan mengembalikan style bertipe", () => {
    expect(
      applyStylePatch(
        { size: { width: { mode: "fill" }, height: { mode: "hug" } }, radius: px(4) },
        { size: { height: { mode: "fixed", value: 120, unit: "px" } }, radius: null },
      ),
    ).toEqual({ size: { width: { mode: "fill" }, height: { mode: "fixed", value: 120, unit: "px" } } });
  });

  it("patch yang menghasilkan style tidak valid diabaikan", () => {
    const style = { layout: { mode: "none" as const } };
    expect(applyStylePatch(style, { layout: { mode: "flex" } })).toBe(style);
  });
});

// T1.8.11: DM-039 display per breakpoint + memo AC DM-036.
describe("display per breakpoint (DM-039)", () => {
  it("mobile mewarisi display tablet; mobile bisa menampilkan kembali", () => {
    const style: ResponsiveStyle = { base: {}, tablet: { display: "none" } };
    expect(resolveStyle(style, "base").display).toBeUndefined();
    expect(resolveStyle(style, "mobile").display).toBe("none");
    expect(resolveStyle({ ...style, mobile: { display: "auto" } }, "mobile").display).toBe("auto");
  });
});

describe("createStyleResolver", () => {
  it("memoize per (nodeId, breakpoint, docRevision)", () => {
    const resolve = createStyleResolver();
    const first = resolve("n_a00000001", dm036, "mobile", 1);
    expect(resolve("n_a00000001", dm036, "mobile", 1)).toBe(first);
    expect(resolve("n_a00000001", dm036, "tablet", 1)).not.toBe(first);

    const changed: ResponsiveStyle = { ...dm036, mobile: { layout: { direction: "row" } } };
    expect(resolve("n_a00000001", changed, "mobile", 2).layout).toMatchObject({ direction: "row" });
    expect(resolve("n_b00000001", dm036, "mobile", 2)).toEqual(first);
  });
});
