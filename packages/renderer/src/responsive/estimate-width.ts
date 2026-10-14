import {
  type LengthValue,
  type Node,
  resolveToken,
  type SiteDocument,
  type Style,
  type TextNode,
  TokenResolveError,
  textLines,
} from "@platform/document-model";

// DM-038 (keputusan T0.8.4): estimasi STATIS lebar konten untuk `stackRows` — tanpa DOM, sama di editor & publish.
// Dipindah dari prototipe `@platform/document-model` (M0) ke renderer (M1).

export interface FontMetrics {
  // Lebar rata-rata satu karakter dalam em untuk family & ketebalan; dari katalog font (M2) — sementara default.
  charWidthEm(family: string | undefined, bold: boolean): number;
}

// SEMENTARA sampai katalog font (M2) menyimpan em/karakter per weight (T0.8.4). Nilai sengaja sedikit lebar
// (condong menumpuk; row meluber lebih buruk daripada row muat yang ikut ditumpuk).
const DEFAULT_CHAR_EM: Record<string, readonly [regular: number, bold: number]> = {
  Inter: [0.53, 0.57],
  "Plus Jakarta Sans": [0.55, 0.59],
  Poppins: [0.58, 0.62],
};
const FALLBACK_CHAR_EM: readonly [number, number] = [0.56, 0.6];

export const DEFAULT_FONT_METRICS: FontMetrics = {
  charWidthEm: (family, bold) => (DEFAULT_CHAR_EM[family ?? ""] ?? FALLBACK_CHAR_EM)[bold ? 1 : 0],
};

// Ukuran font bawaan browser per tag bila typography tidak menentukan (T0.8.4).
const TAG_FONT_SIZE: Record<string, number> = { h1: 32, h2: 24, h3: 18.72, h4: 16, h5: 13.28, h6: 10.72 };
const HEADING_TAGS = new Set(Object.keys(TAG_FONT_SIZE));
const ROOT_FONT_PX = 16;

export interface WidthEstimateContext {
  doc: Pick<SiteDocument, "nodes" | "assets" | "theme">;
  breakpoint: "base" | "tablet" | "mobile";
  // Style efektif node di breakpoint (setelah aturan auto pada ancestor yang sudah diproses).
  styleOf(node: Node): Style;
  fonts: FontMetrics;
}

/** Panjang → px; `null` bila tidak bisa diketahui statis (%, vw, vh, fr, token tak terselesaikan). */
export function lengthPx(value: LengthValue | undefined, ctx: WidthEstimateContext): number | null {
  if (!value) return null;
  let literal: unknown = value;
  if ("$token" in value) {
    try {
      literal = resolveToken(ctx.doc.theme, value.$token, { breakpoint: ctx.breakpoint });
    } catch (error) {
      if (error instanceof TokenResolveError) return null;
      throw error;
    }
  }
  const length = literal as { value?: unknown; unit?: unknown };
  if (typeof length.value !== "number") return null;
  if (length.unit === "px") return length.value;
  if (length.unit === "rem" || length.unit === "em") return length.value * ROOT_FONT_PX;
  return null;
}

const px = (value: LengthValue | undefined, ctx: WidthEstimateContext) => lengthPx(value, ctx) ?? 0;

function flowChildren(node: Node, ctx: WidthEstimateContext): Node[] {
  if (!("children" in node)) return [];
  return node.children
    .map((id) => ctx.doc.nodes[id])
    .filter((child): child is Node => child?.visible === true && ctx.styleOf(child).position?.type !== "absolute");
}

function horizontalPadding(style: Style): (ctx: WidthEstimateContext) => number {
  const padding = style.layout?.mode === "flex" ? style.layout.padding : undefined;
  return (ctx) => px(padding?.left, ctx) + px(padding?.right, ctx);
}

function typographyOf(
  style: Style,
  ctx: WidthEstimateContext,
): { fontSize?: number; family?: string; weight?: number } {
  let typography: unknown = style.typography;
  if (typography && typeof typography === "object" && "$token" in typography) {
    try {
      typography = resolveToken(ctx.doc.theme, (typography as { $token: string }).$token, {
        breakpoint: ctx.breakpoint,
      });
    } catch (error) {
      if (!(error instanceof TokenResolveError)) throw error;
      typography = undefined;
    }
  }
  const value = (typography ?? {}) as { fontSize?: LengthValue; fontFamily?: unknown; fontWeight?: number };
  let family: string | undefined;
  if (typeof value.fontFamily === "string") family = value.fontFamily;
  else if (value.fontFamily && typeof value.fontFamily === "object" && "$token" in value.fontFamily) {
    try {
      family = String(resolveToken(ctx.doc.theme, (value.fontFamily as { $token: string }).$token));
    } catch (error) {
      if (!(error instanceof TokenResolveError)) throw error;
    }
  }
  const fontSize = lengthPx(value.fontSize, ctx) ?? undefined;
  return {
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(family !== undefined ? { family } : {}),
    ...(value.fontWeight !== undefined ? { weight: value.fontWeight } : {}),
  };
}

// Lebar baris teks terpanjang: karakter × ukuran font × em/karakter (tebal lebih lebar).
function textWidth(node: TextNode, style: Style, ctx: WidthEstimateContext): number {
  const typography = typographyOf(style, ctx);
  const tag = node.tag ?? "p";
  const fontSize = typography.fontSize ?? TAG_FONT_SIZE[tag] ?? ROOT_FONT_PX;
  const baseBold = (typography.weight ?? (HEADING_TAGS.has(tag) ? 700 : 400)) >= 600;
  let widest = 0;
  for (const { inlines } of textLines(node.props.content)) {
    let line = 0;
    for (const inline of inlines) {
      if (inline.type === "hardBreak") {
        widest = Math.max(widest, line);
        line = 0;
        continue;
      }
      const bold = baseBold || (inline.marks ?? []).some((mark) => mark.type === "bold");
      line += inline.text.length * fontSize * ctx.fonts.charWidthEm(typography.family, bold);
    }
    widest = Math.max(widest, line);
  }
  return widest;
}

function clampWidth(width: number, style: Style, ctx: WidthEstimateContext): number {
  const max = lengthPx(style.size?.maxWidth, ctx);
  const min = lengthPx(style.size?.minWidth, ctx);
  return Math.max(min ?? 0, max === null ? width : Math.min(width, max));
}

/** Lebar max-content node (px) — sama dengan `width: max-content` di browser, tanpa DOM. */
export function estimateMaxContentWidth(node: Node, ctx: WidthEstimateContext): number {
  const style = ctx.styleOf(node);
  const width = style.size?.width;
  if (width?.mode === "fixed") {
    const fixed = lengthPx({ value: width.value, unit: width.unit }, ctx);
    if (fixed !== null) return clampWidth(fixed, style, ctx);
  }
  let content = 0;
  if (node.type === "text") content = textWidth(node, style, ctx);
  else if (node.type === "image") content = ctx.doc.assets[node.props.image.assetId]?.width ?? 0;
  else {
    const children = flowChildren(node, ctx).map((child) => estimateMaxContentWidth(child, ctx));
    const layout = style.layout;
    const isRow = layout?.mode === "flex" && layout.direction === "row";
    const gap = layout?.mode === "flex" ? px(layout.gap, ctx) : 0;
    content = isRow
      ? children.reduce((sum, child) => sum + child, 0) + gap * Math.max(0, children.length - 1)
      : Math.max(0, ...children);
    content += horizontalPadding(style)(ctx);
  }
  return clampWidth(content, style, ctx);
}

/** Lebar tersedia di breakpoint: lebar preview dikurangi padding ancestor, dibatasi lebar fixed/max ancestor. */
export function estimateAvailableWidth(node: Node, previewWidth: number, ctx: WidthEstimateContext): number {
  const ancestors: Node[] = [];
  for (let parent = node.parentId ? ctx.doc.nodes[node.parentId] : undefined; parent; ) {
    ancestors.unshift(parent);
    parent = parent.parentId ? ctx.doc.nodes[parent.parentId] : undefined;
  }
  let available = previewWidth;
  for (const ancestor of ancestors) {
    const style = ctx.styleOf(ancestor);
    const width = style.size?.width;
    const fixed = width?.mode === "fixed" ? lengthPx({ value: width.value, unit: width.unit }, ctx) : null;
    if (fixed !== null) available = Math.min(available, fixed);
    const max = lengthPx(style.size?.maxWidth, ctx);
    if (max !== null) available = Math.min(available, max);
    available -= horizontalPadding(style)(ctx);
  }
  return Math.max(0, available);
}

/** Jumlah anak alur (terlihat & tidak absolute). */
export function flowChildCount(node: Node, ctx: WidthEstimateContext): number {
  return flowChildren(node, ctx).length;
}

/** Kandidat `stackRows`/`wrapRowsTablet` (DM-038): frame flex row tanpa wrap, ≥ 2 anak alur, bukan tombol. */
export function isStackRowsCandidate(node: Node, ctx: WidthEstimateContext): boolean {
  if (node.type !== "frame" || node.props.role === "button") return false;
  const layout = ctx.styleOf(node).layout;
  return (
    layout?.mode === "flex" && layout.direction === "row" && layout.wrap !== true && flowChildCount(node, ctx) >= 2
  );
}

/**
 * Prediksi statis: konten row tidak muat di lebar breakpoint. `safety` < 1 condong menumpuk — row meluber (scroll
 * horizontal) lebih buruk daripada row muat yang ikut ditumpuk; estimasi lebar teks meleset ±10% (T0.8.4).
 */
export function rowOverflowsStatic(node: Node, previewWidth: number, ctx: WidthEstimateContext, safety = 1): boolean {
  return estimateMaxContentWidth(node, ctx) >= estimateAvailableWidth(node, previewWidth, ctx) * safety;
}
