import { describe, expect, it } from "vitest";
import {
  childLayoutOf,
  colorToCss,
  fillsToCss,
  layoutToCss,
  lengthToCss,
  positionToCss,
  radiusToCss,
  sizeToCss,
  styleToCss,
} from "./style-to-css";

const px = (value: number) => ({ value, unit: "px" as const });

describe("lengthToCss & colorToCss (DM-025, DM-041)", () => {
  it("literal memakai unit, token menjadi CSS variable", () => {
    expect(lengthToCss(px(16))).toBe("16px");
    expect(lengthToCss({ value: 2.5, unit: "rem" })).toBe("2.5rem");
    expect(lengthToCss({ $token: "space.6" })).toBe("var(--space-6)");
    expect(lengthToCss({ $token: "color.brand.600" })).toBe("var(--color-brand-600)");
  });

  it("warna hex apa adanya, token → var, token + alpha → color-mix", () => {
    expect(colorToCss("#FF5A1F")).toBe("#FF5A1F");
    expect(colorToCss({ $token: "color.primary" })).toBe("var(--color-primary)");
    expect(colorToCss({ $token: "color.primary", alpha: 0.2 })).toBe(
      "color-mix(in srgb, var(--color-primary) 20%, transparent)",
    );
  });
});

describe("layoutToCss (DM-026)", () => {
  it.each([
    ["start", "flex-start"],
    ["center", "center"],
    ["end", "flex-end"],
    ["spaceBetween", "space-between"],
    ["spaceAround", "space-around"],
    ["spaceEvenly", "space-evenly"],
  ] as const)("justify %s → justify-content: %s", (justify, css) => {
    expect(layoutToCss({ mode: "flex", direction: "row", justify }).justifyContent).toBe(css);
  });

  it.each([
    ["start", "flex-start"],
    ["center", "center"],
    ["end", "flex-end"],
    ["stretch", "stretch"],
    ["baseline", "baseline"],
  ] as const)("align %s → align-items: %s", (align, css) => {
    expect(layoutToCss({ mode: "flex", direction: "column", align }).alignItems).toBe(css);
  });

  it("flex row: gap di sumbu utama (column-gap), crossGap antar baris saat wrap", () => {
    expect(
      layoutToCss({ mode: "flex", direction: "row", wrap: true, gap: px(24), crossGap: { $token: "space.4" } }),
    ).toEqual({ display: "flex", flexDirection: "row", flexWrap: "wrap", columnGap: "24px", rowGap: "var(--space-4)" });
  });

  it("flex column: gap menjadi row-gap; crossGap default sama dengan gap", () => {
    expect(layoutToCss({ mode: "flex", direction: "column", gap: px(8) })).toEqual({
      display: "flex",
      flexDirection: "column",
      rowGap: "8px",
      columnGap: "8px",
    });
  });

  it("padding sebagian: sisi lain 0", () => {
    expect(layoutToCss({ mode: "flex", direction: "column", padding: { top: px(10), left: px(4) } }).padding).toBe(
      "10px 0 0 4px",
    );
  });

  it("layout none menjadi containing block untuk anak absolute", () => {
    expect(layoutToCss({ mode: "none" })).toEqual({ position: "relative" });
  });
});

describe("sizeToCss (DM-027)", () => {
  it.each([
    ["row", { flex: "1 1 0", minWidth: 0 }],
    ["column", { alignSelf: "stretch" }],
    ["block", { width: "100%" }],
  ] as const)("width fill di parent %s", (parent, css) => {
    expect(sizeToCss({ width: { mode: "fill" } }, parent)).toEqual(css);
  });

  it.each([
    ["column", { flex: "1 1 0", minHeight: 0 }],
    ["row", { alignSelf: "stretch" }],
    ["block", { height: "100%" }],
  ] as const)("height fill di parent %s", (parent, css) => {
    expect(sizeToCss({ height: { mode: "fill" } }, parent)).toEqual(css);
  });

  it("fixed tidak menyusut di sumbu utama parent, kecuali ada batas maksimum", () => {
    const fixed = { width: { mode: "fixed" as const, value: 280, unit: "px" as const } };

    expect(sizeToCss(fixed, "row")).toEqual({ width: "280px", flexShrink: 0 });
    expect(sizeToCss(fixed, "column")).toEqual({ width: "280px" });
    expect(sizeToCss({ ...fixed, maxWidth: { value: 100, unit: "%" } }, "row")).toEqual({
      width: "280px",
      flexShrink: 1,
      maxWidth: "100%",
    });
  });

  it("hug menjadi fit-content; min/max & aspect ratio diteruskan", () => {
    expect(
      sizeToCss(
        {
          width: { mode: "hug" },
          height: { mode: "hug" },
          minHeight: px(560),
          maxWidth: { $token: "size.container" },
          aspectRatio: 1.5,
        },
        "block",
      ),
    ).toEqual({
      width: "fit-content",
      height: "fit-content",
      minHeight: "560px",
      maxWidth: "var(--size-container)",
      aspectRatio: "1.5",
    });
  });
});

describe("fillsToCss (DM-029)", () => {
  it("satu fill solid menjadi background-color, opacity lewat color-mix", () => {
    expect(fillsToCss([{ type: "solid", color: "#000000" }])).toEqual({ backgroundColor: "#000000" });
    expect(fillsToCss([{ type: "solid", color: "#000000", opacity: 0.5 }])).toEqual({
      backgroundColor: "color-mix(in srgb, #000000 50%, transparent)",
    });
  });

  it("beberapa fill: urutan dibalik (index 0 = paling bawah) dan fill tersembunyi dilewati", () => {
    expect(
      fillsToCss([
        { type: "solid", color: "#111111" },
        { type: "solid", color: "#222222", visible: false },
        { type: "solid", color: "#333333" },
      ]),
    ).toEqual({ backgroundImage: "linear-gradient(#333333, #333333), linear-gradient(#111111, #111111)" });
  });

  it("tanpa fill terlihat tidak menghasilkan background", () => {
    expect(fillsToCss([{ type: "solid", color: "#111111", visible: false }])).toEqual({});
  });
});

describe("radiusToCss (DM-030)", () => {
  it("nilai tunggal dan per sudut", () => {
    expect(radiusToCss({ $token: "radius.lg" })).toEqual({ borderRadius: "var(--radius-lg)" });
    expect(radiusToCss(px(4))).toEqual({ borderRadius: "4px" });
    expect(radiusToCss({ topLeft: px(24), bottomRight: px(8) })).toEqual({
      borderTopLeftRadius: "24px",
      borderBottomRightRadius: "8px",
    });
  });
});

describe("styleToCss & childLayoutOf", () => {
  it("menggabungkan semua group style", () => {
    expect(
      styleToCss(
        {
          layout: { mode: "flex", direction: "row" },
          size: { width: { mode: "fill" } },
          fills: [{ type: "solid", color: "#FFFFFF" }],
          radius: px(2),
        },
        "column",
      ),
    ).toEqual({
      display: "flex",
      flexDirection: "row",
      alignSelf: "stretch",
      backgroundColor: "#FFFFFF",
      borderRadius: "2px",
    });
  });

  it("arah layout yang diwariskan ke anak", () => {
    expect(childLayoutOf({ layout: { mode: "flex", direction: "row" } })).toBe("row");
    expect(childLayoutOf({ layout: { mode: "flex", direction: "column" } })).toBe("column");
    expect(childLayoutOf({ layout: { mode: "none" } })).toBe("block");
    expect(childLayoutOf({})).toBe("block");
  });
});

describe("positionToCss (DM-028)", () => {
  it("absolute → left/top px; flow tanpa CSS", () => {
    expect(positionToCss({ type: "absolute", x: 80, y: -12.5 })).toEqual({
      position: "absolute",
      left: "80px",
      top: "-12.5px",
    });
    expect(positionToCss({ type: "flow" })).toEqual({});
  });

  it("absolute menang atas position relative dari layout none", () => {
    expect(styleToCss({ layout: { mode: "none" }, position: { type: "absolute", x: 1, y: 2 } }, "block")).toMatchObject(
      {
        position: "absolute",
        left: "1px",
        top: "2px",
      },
    );
  });
});

describe("sizeToCss & radiusToCss — sisa kasus", () => {
  it("tinggi fixed di parent kolom boleh menyusut bila ada maxHeight", () => {
    expect(
      sizeToCss({ height: { mode: "fixed", value: 300, unit: "px" }, maxHeight: { value: 50, unit: "vh" } }, "column"),
    ).toEqual({ height: "300px", flexShrink: 1, maxHeight: "50vh" });
  });

  it("radius sebagian sudut kanan-atas & kiri-bawah", () => {
    expect(radiusToCss({ topRight: px(3), bottomLeft: px(6) })).toEqual({
      borderTopRightRadius: "3px",
      borderBottomLeftRadius: "6px",
    });
  });
});
