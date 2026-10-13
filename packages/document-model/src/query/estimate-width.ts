import type { LengthValue, Node, SiteDocument, Style, TextNode } from "../schema";
import { type Breakpoint, resolveStyle } from "./resolve-style";

// PROTOTIPE (spike M0, T0.8.4 / OPEN-DM-5): estimasi statis lebar konten untuk rule `stackRows` (DM-038),
// tanpa DOM. Dipertahankan atau dibuang sesuai keputusan T0.8.4; implementasi final di `packages/renderer` (M1).

export interface TextMetrics {
  // Ukuran font (px) teks node. Prototipe: dari tag (default browser); nanti dari typography style (DM-0xx).
  fontSizePx(node: TextNode): number;
  // Lebar rata-rata satu karakter dalam em untuk font situs; dihitung sekali per font (katalog font), bukan per dokumen.
  charWidthEm(bold: boolean): number;
}

export interface WidthEstimateContext {
  nodes: SiteDocument["nodes"];
  assets: SiteDocument["assets"];
  breakpoint: Breakpoint;
  // Panjang → px; `null` jika tidak bisa diketahui statis (%, vw, token tak dikenal).
  lengthPx(value: LengthValue): number | null;
  text: TextMetrics;
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function styleOf(node: Node, ctx: WidthEstimateContext): Style {
  return resolveStyle(node.style, ctx.breakpoint);
}

// Anak yang ikut alur layout: terlihat & tidak absolute.
function flowChildren(node: Node, ctx: WidthEstimateContext): Node[] {
  if (!("children" in node)) return [];
  return node.children
    .map((id) => ctx.nodes[id])
    .filter((child): child is Node => child?.visible === true && styleOf(child, ctx).position?.type !== "absolute");
}

function px(value: LengthValue | undefined, ctx: WidthEstimateContext): number {
  return value ? (ctx.lengthPx(value) ?? 0) : 0;
}

function horizontalPadding(style: Style, ctx: WidthEstimateContext): number {
  const padding = style.layout?.mode === "flex" ? style.layout.padding : undefined;
  return px(padding?.left, ctx) + px(padding?.right, ctx);
}

// Lebar satu baris teks: jumlah karakter × ukuran font × lebar rata-rata karakter (tebal lebih lebar).
function textWidth(node: TextNode, ctx: WidthEstimateContext): number {
  const fontSize = ctx.text.fontSizePx(node);
  const headingBold = HEADING_TAGS.has(node.tag ?? "p");
  let widest = 0;
  for (const block of node.props.content.content) {
    let line = 0;
    for (const inline of block.content ?? []) {
      if (inline.type === "hardBreak") {
        widest = Math.max(widest, line);
        line = 0;
        continue;
      }
      const bold = headingBold || (inline.marks ?? []).some((mark) => mark.type === "bold");
      line += inline.text.length * fontSize * ctx.text.charWidthEm(bold);
    }
    widest = Math.max(widest, line);
  }
  return widest;
}

function clampWidth(width: number, style: Style, ctx: WidthEstimateContext): number {
  const max = style.size?.maxWidth ? ctx.lengthPx(style.size.maxWidth) : null;
  const min = style.size?.minWidth ? ctx.lengthPx(style.size.minWidth) : null;
  return Math.max(min ?? 0, max === null ? width : Math.min(width, max));
}

/**
 * Lebar max-content node (px CSS): lebar yang dipakai jika tidak ada batas lebar dari parent
 * (teks satu baris, anak row berjajar). Sama dengan `width: max-content` di browser, tanpa DOM.
 */
export function estimateMaxContentWidth(node: Node, ctx: WidthEstimateContext): number {
  const style = styleOf(node, ctx);
  const width = style.size?.width;
  if (width?.mode === "fixed") {
    const fixed = ctx.lengthPx({ value: width.value, unit: width.unit });
    if (fixed !== null) return clampWidth(fixed, style, ctx);
  }

  let content = 0;
  if (node.type === "text") content = textWidth(node, ctx);
  else if (node.type === "image") {
    // Lebar alami gambar dari metadata asset (DM-057) — sama dengan yang dipakai browser.
    content = ctx.assets[node.props.image.assetId]?.width ?? 0;
  } else {
    const children = flowChildren(node, ctx).map((child) => estimateMaxContentWidth(child, ctx));
    const layout = style.layout;
    const isRow = layout?.mode === "flex" && layout.direction === "row";
    const gap = layout?.mode === "flex" ? px(layout.gap, ctx) : 0;
    content = isRow
      ? children.reduce((sum, child) => sum + child, 0) + gap * Math.max(0, children.length - 1)
      : Math.max(0, ...children);
    content += horizontalPadding(style, ctx);
  }
  return clampWidth(content, style, ctx);
}

/**
 * Lebar yang tersedia bagi node di breakpoint: lebar preview dikurangi padding horizontal ancestor,
 * dibatasi lebar fixed ancestor. Ancestor row dianggap sudah ditumpuk (rule diterapkan dari luar ke dalam).
 */
export function estimateAvailableWidth(node: Node, previewWidth: number, ctx: WidthEstimateContext): number {
  const ancestors: Node[] = [];
  for (let parent = node.parentId ? ctx.nodes[node.parentId] : undefined; parent; ) {
    ancestors.unshift(parent);
    parent = parent.parentId ? ctx.nodes[parent.parentId] : undefined;
  }
  let available = previewWidth;
  for (const ancestor of ancestors) {
    const style = styleOf(ancestor, ctx);
    const width = style.size?.width;
    const fixed = width?.mode === "fixed" ? ctx.lengthPx({ value: width.value, unit: width.unit }) : null;
    if (fixed !== null) available = Math.min(available, fixed);
    const max = style.size?.maxWidth ? ctx.lengthPx(style.size.maxWidth) : null;
    if (max !== null) available = Math.min(available, max);
    available -= horizontalPadding(style, ctx);
  }
  return Math.max(0, available);
}

// Kandidat `stackRows` (DM-038): frame flex row tanpa wrap, ≥ 2 anak alur, bukan tombol.
export function isStackRowsCandidate(node: Node, ctx: WidthEstimateContext): boolean {
  if (node.type !== "frame" || node.props.role === "button") return false;
  const layout = styleOf(node, ctx).layout;
  return (
    layout?.mode === "flex" && layout.direction === "row" && layout.wrap !== true && flowChildren(node, ctx).length >= 2
  );
}

// Prediksi statis: konten row tidak muat di lebar breakpoint → rule `stackRows` berlaku.
// `safety` < 1 sengaja condong ke menumpuk: row yang meluber (scroll horizontal) lebih buruk daripada
// row muat yang ikut ditumpuk, dan estimasi lebar teks meleset ±10% (T0.8.4).
export function rowOverflowsStatic(node: Node, previewWidth: number, ctx: WidthEstimateContext, safety = 1): boolean {
  return estimateMaxContentWidth(node, ctx) > estimateAvailableWidth(node, previewWidth, ctx) * safety;
}
