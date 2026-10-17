import type {
  Dimension,
  Fill,
  LayoutStyle,
  Node,
  RadiusValue,
  SizeStyle,
  Stroke,
  Style,
  Theme,
  TypographyStyle,
} from "@platform/document-model";
import { tokenEntry } from "@platform/document-model";
import { colorToCss, cssString, lengthToCss, tokenVar, typographyVarName } from "./values";

// Pemetaan style dokumen → deklarasi CSS (spec 07 §4.2, DM-026–DM-032). Fungsi murni & deterministik: urutan
// deklarasi tetap (dipakai sebagai signature class). Diporting dari prototipe canvas M0 + kelompok style M1.

export type Declaration = readonly [property: string, value: string];
// Arah layout parent menentukan arti `fill` (DM-027).
export type ParentLayout = "row" | "column" | "block";

export interface DeclarationContext {
  parent: ParentLayout;
  theme: Theme;
  assetUrl: (assetId: string) => string;
  // ED-098: ukuran px fixed parent (bila diketahui) untuk CSS constraints child absolute.
  parentWidth?: number | undefined;
  parentHeight?: number | undefined;
}

const JUSTIFY: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly",
};
const ALIGN: Record<string, string> = {
  auto: "auto",
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};
// ED-119: perataan vertikal teks (flex column justify-content).
const VERTICAL_ALIGN: Record<"top" | "middle" | "bottom", string> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

function layout(value: LayoutStyle, out: Declaration[]): void {
  // `none`: anak bebas (absolute) → node jadi containing block.
  if (value.mode === "none") {
    out.push(["position", "relative"]);
    return;
  }
  out.push(["display", "flex"], ["flex-direction", value.direction]);
  if (value.wrap) out.push(["flex-wrap", "wrap"]);
  if (value.align) out.push(["align-items", ALIGN[value.align] ?? value.align]);
  if (value.justify) out.push(["justify-content", JUSTIFY[value.justify] ?? value.justify]);
  // `gap` = sumbu utama, `crossGap` = antar baris saat wrap (default sama dengan gap).
  const main = value.gap ? lengthToCss(value.gap) : undefined;
  const cross = value.crossGap ? lengthToCss(value.crossGap) : main;
  const [rowGap, columnGap] = value.direction === "row" ? [cross, main] : [main, cross];
  if (rowGap) out.push(["row-gap", rowGap]);
  if (columnGap) out.push(["column-gap", columnGap]);
  // DM-026: padding sebagian valid, sisi lain 0.
  const { padding } = value;
  if (padding) {
    out.push([
      "padding",
      [padding.top, padding.right, padding.bottom, padding.left]
        .map((side) => (side ? lengthToCss(side) : "0"))
        .join(" "),
    ]);
  }
}

function dimension(axis: "width" | "height", value: Dimension, parent: ParentLayout, out: Declaration[]): void {
  const mainAxis = parent === (axis === "width" ? "row" : "column");
  const crossAxis = parent === (axis === "width" ? "column" : "row");
  switch (value.mode) {
    case "fixed":
      out.push([axis, `${value.value}${value.unit}`]);
      if (mainAxis) out.push(["flex-shrink", "0"]);
      return;
    case "hug":
      out.push([axis, "fit-content"]);
      return;
    case "fill":
      if (mainAxis) out.push(["flex", "1 1 0"], [axis === "width" ? "min-width" : "min-height", "0"]);
      else if (crossAxis) out.push(["align-self", "stretch"]);
      else out.push([axis, "100%"]);
  }
}

function size(value: SizeStyle, parent: ParentLayout, out: Declaration[]): void {
  const start = out.length;
  if (value.width) dimension("width", value.width, parent, out);
  if (value.height) dimension("height", value.height, parent, out);
  if (value.minWidth) out.push(["min-width", lengthToCss(value.minWidth)]);
  if (value.maxWidth) out.push(["max-width", lengthToCss(value.maxWidth)]);
  if (value.minHeight) out.push(["min-height", lengthToCss(value.minHeight)]);
  if (value.maxHeight) out.push(["max-height", lengthToCss(value.maxHeight)]);
  if (value.aspectRatio) out.push(["aspect-ratio", String(value.aspectRatio)]);
  // DM-027: fixed boleh menyusut bila ada batas maksimum di sumbu utama.
  const shrinkIndex = out.findIndex(([property], index) => index >= start && property === "flex-shrink");
  if (shrinkIndex >= 0 && ((parent === "row" && value.maxWidth) || (parent === "column" && value.maxHeight))) {
    out[shrinkIndex] = ["flex-shrink", "1"];
  }
}

function solidColor(fill: Extract<Fill, { type: "solid" }>): string {
  const color = colorToCss(fill.color);
  return fill.opacity === undefined ? color : `color-mix(in srgb, ${color} ${fill.opacity * 100}%, transparent)`;
}

// DM-029: index 0 = layer paling bawah; layer CSS pertama = paling atas → urutan dibalik.
function fills(value: readonly Fill[], ctx: DeclarationContext, out: Declaration[]): void {
  const visible = value.filter((fill) => fill.visible !== false);
  if (visible.length === 0) return;
  const [only] = visible;
  if (visible.length === 1 && only?.type === "solid") {
    out.push(["background-color", solidColor(only)]);
    return;
  }
  const layers = [...visible].reverse();
  out.push([
    "background-image",
    layers
      .map((fill) => {
        if (fill.type === "solid") {
          const color = solidColor(fill);
          return `linear-gradient(${color}, ${color})`;
        }
        return `url(${cssString(ctx.assetUrl(fill.image.assetId))})`;
      })
      .join(", "),
  ]);
  const imageLayer = (map: (fill: Extract<Fill, { type: "image" }>) => string, solid: string) =>
    layers.map((fill) => (fill.type === "image" ? map(fill) : solid)).join(", ");
  if (layers.some((fill) => fill.type === "image")) {
    out.push(
      ["background-size", imageLayer((fill) => (fill.fit === "tile" ? "auto" : fill.fit), "auto")],
      ["background-repeat", imageLayer((fill) => (fill.fit === "tile" ? "repeat" : "no-repeat"), "repeat")],
      [
        "background-position",
        imageLayer((fill) => {
          const focal = fill.image.focalPoint;
          return focal ? `${focal.x * 100}% ${focal.y * 100}%` : "50% 50%";
        }, "0 0"),
      ],
    );
  }
}

// DM-030: inside = border (box-sizing border-box → ukuran node tetap); outside/center = outline.
function strokes(value: readonly Stroke[], out: Declaration[]): void {
  const stroke = value.find((item) => item.visible !== false);
  if (!stroke) return;
  const width = lengthToCss(stroke.width);
  const style = stroke.style ?? "solid";
  const color = colorToCss(stroke.color);
  const position = stroke.position ?? "inside";
  if (position !== "inside" && !stroke.sides) {
    out.push(["outline", `${width} ${style} ${color}`]);
    out.push(["outline-offset", position === "outside" ? "0" : `calc(${width} / -2)`]);
    return;
  }
  const sides = stroke.sides;
  if (!sides) {
    out.push(["border", `${width} ${style} ${color}`]);
    return;
  }
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (sides[side] !== false) out.push([`border-${side}`, `${width} ${style} ${color}`]);
  }
}

function radius(value: RadiusValue, out: Declaration[]): void {
  if ("$token" in value || "unit" in value) {
    out.push(["border-radius", lengthToCss(value)]);
    return;
  }
  const corners = [
    ["top-left", value.topLeft],
    ["top-right", value.topRight],
    ["bottom-right", value.bottomRight],
    ["bottom-left", value.bottomLeft],
  ] as const;
  for (const [corner, length] of corners) if (length) out.push([`border-${corner}-radius`, lengthToCss(length)]);
}

const TYPOGRAPHY_FIELDS: readonly (readonly [keyof TypographyStyle, string])[] = [
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontWeight", "font-weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
  ["textTransform", "text-transform"],
  ["textDecoration", "text-decoration"],
  ["textAlign", "text-align"],
  ["fontStyle", "font-style"],
];

/** Nilai CSS satu field typography (dipakai juga generator token). */
export function typographyValue(field: keyof TypographyStyle, value: unknown, theme: Theme): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && "$token" in value) return tokenVar(value as { $token: string });
  switch (field) {
    case "fontFamily":
      return fontStack(String(value), theme);
    case "fontSize":
    case "letterSpacing":
      return lengthToCss(value as never);
    case "lineHeight":
      return typeof value === "number" ? String(value) : lengthToCss(value as never);
    case "textDecoration":
      return value === "lineThrough" ? "line-through" : String(value);
    default:
      return String(value);
  }
}

/** Family terdaftar → `"Nama", <fallback>` (fallback dari theme.fonts, DM-041). */
export function fontStack(family: string, theme: Theme): string {
  const fallback = theme.fonts.find((font) => font.family === family)?.fallback ?? "sans-serif";
  return `${cssString(family)}, ${fallback}`;
}

function typography(value: NonNullable<Style["typography"]>, ctx: DeclarationContext, out: Declaration[]): void {
  if ("$token" in value) {
    // Token komposit: satu variabel per field (keputusan owner 2026-10-15); hanya field yang ada di token.
    const entry = tokenEntry(ctx.theme, value.$token) as Record<string, unknown> | undefined;
    const fields = entry && "value" in entry ? (entry.value as Record<string, unknown>) : entry;
    for (const [field, property] of TYPOGRAPHY_FIELDS) {
      if (fields?.[field] !== undefined) out.push([property, `var(${typographyVarName(value.$token, property)})`]);
    }
    return;
  }
  for (const [field, property] of TYPOGRAPHY_FIELDS) {
    const css = typographyValue(field, value[field], ctx.theme);
    if (css !== undefined) out.push([property, css]);
  }
}

// DM-028: absolute = px relatif ke parent. Constraints (kanan/tengah/skala) butuh ukuran parent → aturan responsif T1.10.4.
// ED-098/DM-028: nilai px fixed dari Dimension (constraints butuh W/H & PW/PH dalam px); selain itu undefined.
export function fixedPx(dimension: NonNullable<Style["size"]>["width"]): number | undefined {
  return dimension && dimension.mode === "fixed" && dimension.unit === "px" ? dimension.value : undefined;
}

export interface AbsoluteBox {
  x: number;
  y: number;
  width?: number | undefined;
  height?: number | undefined;
}
type Horizontal = "left" | "right" | "leftRight" | "center" | "scale";
type Vertical = "top" | "bottom" | "topBottom" | "center" | "scale";

const px = (value: number) => `${Math.round(value)}px`;
const pct = (ratio: number) => `${Math.round(ratio * 1000) / 10}%`;

function horizontalConstraint(
  kind: Horizontal,
  x: number,
  w: number | undefined,
  pw: number | undefined,
): Declaration[] {
  const right = pw !== undefined && w !== undefined ? pw - x - w : undefined;
  switch (kind) {
    case "right":
      return right !== undefined ? [["right", px(right)]] : [["left", px(x)]];
    case "leftRight":
      return right !== undefined
        ? [
            ["left", px(x)],
            ["right", px(right)],
            ["width", "auto"],
          ]
        : [["left", px(x)]];
    case "center":
      return pw !== undefined
        ? [
            ["left", "50%"],
            ["margin-left", px(x - pw / 2)],
          ]
        : [["left", px(x)]];
    case "scale":
      return pw !== undefined && pw > 0
        ? w !== undefined
          ? [
              ["left", pct(x / pw)],
              ["width", pct(w / pw)],
            ]
          : [["left", pct(x / pw)]]
        : [["left", px(x)]];
    default:
      return [["left", px(x)]];
  }
}

function verticalConstraint(kind: Vertical, y: number, h: number | undefined, ph: number | undefined): Declaration[] {
  const bottom = ph !== undefined && h !== undefined ? ph - y - h : undefined;
  switch (kind) {
    case "bottom":
      return bottom !== undefined ? [["bottom", px(bottom)]] : [["top", px(y)]];
    case "topBottom":
      return bottom !== undefined
        ? [
            ["top", px(y)],
            ["bottom", px(bottom)],
            ["height", "auto"],
          ]
        : [["top", px(y)]];
    case "center":
      return ph !== undefined
        ? [
            ["top", "50%"],
            ["margin-top", px(y - ph / 2)],
          ]
        : [["top", px(y)]];
    case "scale":
      return ph !== undefined && ph > 0
        ? h !== undefined
          ? [
              ["top", pct(y / ph)],
              ["height", pct(h / ph)],
            ]
          : [["top", pct(y / ph)]]
        : [["top", px(y)]];
    default:
      return [["top", px(y)]];
  }
}

/** ED-098: CSS posisi child absolute dari constraints + ukuran parent (px). Fallback Left/Top bila dimensi tak diketahui. */
export function constraintDeclarations(
  box: AbsoluteBox,
  parent: { width?: number | undefined; height?: number | undefined },
  constraints: { horizontal: Horizontal; vertical: Vertical } | undefined,
): Declaration[] {
  const c = constraints ?? { horizontal: "left", vertical: "top" };
  return [
    ...horizontalConstraint(c.horizontal, box.x, box.width, parent.width),
    ...verticalConstraint(c.vertical, box.y, box.height, parent.height),
  ];
}

// DM-031: efek bayangan → `box-shadow` (innerShadow = `inset`); layer tersembunyi dilewati.
function effects(value: NonNullable<Style["effects"]>, out: Declaration[]): void {
  const visible = value.filter((shadow) => shadow.visible !== false);
  if (visible.length === 0) return;
  const shadows = visible.map((shadow) => {
    const inset = shadow.type === "innerShadow" ? "inset " : "";
    return `${inset}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread ?? 0}px ${colorToCss(shadow.color)}`;
  });
  out.push(["box-shadow", shadows.join(", ")]);
}

function position(style: Style, ctx: DeclarationContext, out: Declaration[]): void {
  const value = style.position;
  if (value?.type !== "absolute") return;
  out.push(["position", "absolute"]);
  out.push(
    ...constraintDeclarations(
      { x: value.x, y: value.y, width: fixedPx(style.size?.width), height: fixedPx(style.size?.height) },
      { width: ctx.parentWidth, height: ctx.parentHeight },
      value.constraints,
    ),
  );
}

// DM-033: transform CSS (translate → rotate → scale); flip = skala negatif. Tidak memengaruhi layout.
function transform(value: NonNullable<Style["transform"]>, out: Declaration[]): void {
  const parts: string[] = [];
  if (value.translateX || value.translateY) {
    const tx = value.translateX ? lengthToCss(value.translateX) : "0";
    const ty = value.translateY ? lengthToCss(value.translateY) : "0";
    parts.push(`translate(${tx}, ${ty})`);
  }
  if (value.rotate) parts.push(`rotate(${value.rotate}deg)`);
  const scaleX = (value.scaleX ?? 1) * (value.flipX ? -1 : 1);
  const scaleY = (value.scaleY ?? 1) * (value.flipY ? -1 : 1);
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX}, ${scaleY})`);
  if (parts.length > 0) out.push(["transform", parts.join(" ")]);
  // Default origin CSS = center; hanya topLeft yang perlu ditulis.
  if (value.origin === "topLeft") out.push(["transform-origin", "top left"]);
}

export function styleDeclarations(style: Style, ctx: DeclarationContext): Declaration[] {
  const out: Declaration[] = [];
  if (style.layout) layout(style.layout, out);
  if (style.size) size(style.size, ctx.parent, out);
  if (style.flexChild) {
    const { alignSelf, grow, shrink } = style.flexChild;
    if (alignSelf) out.push(["align-self", ALIGN[alignSelf] ?? alignSelf]);
    if (grow !== undefined) out.push(["flex-grow", String(grow)]);
    if (shrink !== undefined) out.push(["flex-shrink", String(shrink)]);
  }
  if (style.fills) fills(style.fills, ctx, out);
  if (style.strokes) strokes(style.strokes, out);
  if (style.radius) radius(style.radius, out);
  if (style.typography) typography(style.typography, ctx, out);
  // ED-119: perataan vertikal teks → flex column + justify-content (hanya bila node bukan container flex).
  if (style.textAlignVertical && !style.layout) {
    out.push(
      ["display", "flex"],
      ["flex-direction", "column"],
      ["justify-content", VERTICAL_ALIGN[style.textAlignVertical]],
    );
  }
  if (style.color) out.push(["color", colorToCss(style.color)]);
  // DM-031/ED-108: efek bayangan → box-shadow (innerShadow = inset).
  if (style.effects) effects(style.effects, out);
  // DM-031/ED-110: opacity layer (0 valid → cek undefined).
  if (style.opacity !== undefined) out.push(["opacity", String(style.opacity)]);
  if (style.transform) transform(style.transform, out);
  // Terakhir: `position: absolute` menang atas `relative` dari layout none; constraints memakai ukuran parent.
  if (style.position) position(style, ctx, out);
  // DM-039: sembunyi di breakpoint ini.
  if (style.display === "none") out.push(["display", "none"]);
  return out;
}

/** Deklarasi tingkat node (di luar style): containing block, clip, gambar, frame berlink. */
export function nodeDeclarations(node: Node, style: Style): Declaration[] {
  const out: Declaration[] = [];
  const container = node.type === "page" || node.type === "frame";
  // Frame & page = containing block anak absolute (seperti frame Figma), juga di auto-layout.
  if (container && style.position?.type !== "absolute" && style.layout?.mode !== "none")
    out.push(["position", "relative"]);
  if (node.type === "frame") {
    // DM-011: clipContent = overflow hidden.
    if (node.props.clipContent) out.push(["overflow", "hidden"]);
    // Frame berlink dirender <a>: tetap blok & tanpa gaya link bawaan.
    if (node.props.link) {
      if (style.layout?.mode !== "flex") out.push(["display", "block"]);
      out.push(["color", "inherit"], ["text-decoration", "none"]);
    }
  }
  // ED-123: text auto width = tidak wrap (lebar mengikuti konten). Auto height/fixed = wrap normal.
  if (node.type === "text" && node.props.autoSize === "width") out.push(["white-space", "nowrap"]);
  if (node.type === "image") out.push(["display", "block"], ["object-fit", node.props.fit]);
  // DM-016: shape ellipse = lingkaran/oval lewat border-radius; rect/line memakai radius/stroke dari style.
  if (node.type === "shape" && node.props.shape === "ellipse") out.push(["border-radius", "50%"]);
  // DM-015: ikon = elemen inline-flex square (ukuran dari style), warna currentColor.
  if (node.type === "icon") out.push(["display", "inline-flex"], ["line-height", "0"]);
  return out;
}

export function childLayoutOf(style: Style): ParentLayout {
  return style.layout?.mode === "flex" ? style.layout.direction : "block";
}
