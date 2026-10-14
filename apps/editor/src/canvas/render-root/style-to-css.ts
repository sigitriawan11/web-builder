import type {
  ColorValue,
  Dimension,
  Fill,
  LayoutStyle,
  LengthValue,
  PositionStyle,
  RadiusValue,
  SizeStyle,
  Style,
} from "@platform/document-model";
import type { CSSProperties } from "react";
import { tokenVar } from "./tokens";

// Pemetaan style dokumen → CSS (DM-026, DM-027, DM-029, DM-030). Prototipe M0: hanya breakpoint `base`.

// Arah layout parent menentukan arti `fill` (DM-027).
export type ParentLayout = "row" | "column" | "block";

export function lengthToCss(value: LengthValue): string {
  return "$token" in value ? tokenVar(value.$token) : `${value.value}${value.unit}`;
}

export function colorToCss(color: ColorValue): string {
  if (typeof color === "string") return color;
  if ("alpha" in color) return `color-mix(in srgb, ${tokenVar(color.$token)} ${color.alpha * 100}%, transparent)`;
  return tokenVar(color.$token);
}

const JUSTIFY: Record<NonNullable<Extract<LayoutStyle, { mode: "flex" }>["justify"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly",
};

const ALIGN: Record<NonNullable<Extract<LayoutStyle, { mode: "flex" }>["align"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

export function layoutToCss(layout: LayoutStyle): CSSProperties {
  // `none`: anak diposisikan bebas; posisi absolute (DM-028) belum ada di prototipe.
  if (layout.mode === "none") return { position: "relative" };

  const css: CSSProperties = { display: "flex", flexDirection: layout.direction };
  if (layout.wrap) css.flexWrap = "wrap";
  if (layout.align) css.alignItems = ALIGN[layout.align];
  if (layout.justify) css.justifyContent = JUSTIFY[layout.justify];

  // `gap` = sumbu utama, `crossGap` = antar baris saat wrap (default sama dengan gap).
  const mainGap = layout.gap ? lengthToCss(layout.gap) : undefined;
  const crossGap = layout.crossGap ? lengthToCss(layout.crossGap) : mainGap;
  if (layout.direction === "row") {
    if (mainGap) css.columnGap = mainGap;
    if (crossGap) css.rowGap = crossGap;
  } else {
    if (mainGap) css.rowGap = mainGap;
    if (crossGap) css.columnGap = crossGap;
  }

  // DM-026: padding sebagian valid, sisi lain 0.
  const { padding } = layout;
  if (padding) {
    css.padding = [padding.top, padding.right, padding.bottom, padding.left]
      .map((side) => (side ? lengthToCss(side) : "0"))
      .join(" ");
  }
  return css;
}

function dimensionToCss(axis: "width" | "height", dimension: Dimension, parent: ParentLayout): CSSProperties {
  const mainAxis = parent === (axis === "width" ? "row" : "column");
  const crossAxis = parent === (axis === "width" ? "column" : "row");

  switch (dimension.mode) {
    case "fixed":
      return { [axis]: `${dimension.value}${dimension.unit}`, ...(mainAxis ? { flexShrink: 0 } : {}) };
    case "hug":
      return { [axis]: "fit-content" };
    case "fill":
      if (mainAxis) return { flex: "1 1 0", [axis === "width" ? "minWidth" : "minHeight"]: 0 };
      if (crossAxis) return { alignSelf: "stretch" };
      return { [axis]: "100%" };
  }
}

export function sizeToCss(size: SizeStyle, parent: ParentLayout): CSSProperties {
  const css: CSSProperties = {
    ...(size.width ? dimensionToCss("width", size.width, parent) : {}),
    ...(size.height ? dimensionToCss("height", size.height, parent) : {}),
  };
  if (size.minWidth) css.minWidth = lengthToCss(size.minWidth);
  if (size.maxWidth) css.maxWidth = lengthToCss(size.maxWidth);
  if (size.minHeight) css.minHeight = lengthToCss(size.minHeight);
  if (size.maxHeight) css.maxHeight = lengthToCss(size.maxHeight);
  if (size.aspectRatio) css.aspectRatio = String(size.aspectRatio);
  // DM-027: fixed boleh menyusut jika ada batas maksimum.
  if (css.flexShrink === 0 && ((parent === "row" && size.maxWidth) || (parent === "column" && size.maxHeight))) {
    css.flexShrink = 1;
  }
  return css;
}

type SolidFill = Extract<Fill, { type: "solid" }>;

function solidFillColor(fill: SolidFill): string {
  const color = colorToCss(fill.color);
  return fill.opacity === undefined ? color : `color-mix(in srgb, ${color} ${fill.opacity * 100}%, transparent)`;
}

// DM-029: index 0 = layer paling bawah; layer CSS pertama = paling atas, jadi urutan dibalik.
export function fillsToCss(fills: readonly Fill[]): CSSProperties {
  // Fill gambar butuh URL asset (CDN/varian) yang belum tersedia di canvas prototipe → dilewati sampai renderer T1.10.
  const visible = fills.filter((fill): fill is SolidFill => fill.type === "solid" && fill.visible !== false);
  if (visible.length === 0) return {};
  if (visible.length === 1 && visible[0]) return { backgroundColor: solidFillColor(visible[0]) };
  return {
    backgroundImage: [...visible]
      .reverse()
      .map((fill) => {
        const color = solidFillColor(fill);
        return `linear-gradient(${color}, ${color})`;
      })
      .join(", "),
  };
}

export function radiusToCss(radius: RadiusValue): CSSProperties {
  if ("$token" in radius || "unit" in radius) return { borderRadius: lengthToCss(radius) };
  const css: CSSProperties = {};
  if (radius.topLeft) css.borderTopLeftRadius = lengthToCss(radius.topLeft);
  if (radius.topRight) css.borderTopRightRadius = lengthToCss(radius.topRight);
  if (radius.bottomRight) css.borderBottomRightRadius = lengthToCss(radius.bottomRight);
  if (radius.bottomLeft) css.borderBottomLeftRadius = lengthToCss(radius.bottomLeft);
  return css;
}

// DM-028: absolute = px relatif ke parent (constraints belum diterapkan di prototipe: selalu kiri/atas).
export function positionToCss(position: PositionStyle): CSSProperties {
  return position.type === "absolute" ? { position: "absolute", left: `${position.x}px`, top: `${position.y}px` } : {};
}

export function styleToCss(style: Style, parent: ParentLayout): CSSProperties {
  return {
    ...(style.layout ? layoutToCss(style.layout) : {}),
    ...(style.size ? sizeToCss(style.size, parent) : {}),
    ...(style.fills ? fillsToCss(style.fills) : {}),
    ...(style.radius ? radiusToCss(style.radius) : {}),
    // Terakhir: `position: absolute` milik node menang atas `relative` dari layout none.
    ...(style.position ? positionToCss(style.position) : {}),
  };
}

// Arah layout yang diwariskan node ini ke anak-anaknya.
export function childLayoutOf(style: Style): ParentLayout {
  return style.layout?.mode === "flex" ? style.layout.direction : "block";
}
