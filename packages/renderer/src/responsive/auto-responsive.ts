import {
  type AutoRuleId,
  DEFAULT_MOBILE_SCALE,
  type LayoutStyle,
  type LengthValue,
  type Node,
  type Padding,
  resolveStyle,
  type SiteDocument,
  type SiteSettings,
  type Style,
} from "@platform/document-model";
import type { Declaration } from "../css/declarations";
import {
  DEFAULT_FONT_METRICS,
  estimateMaxContentWidth,
  type FontMetrics,
  isStackRowsCandidate,
  lengthPx,
  rowOverflowsStatic,
  type WidthEstimateContext,
} from "./estimate-width";

// DM-038: aturan auto-responsive = transformasi render DI ATAS style efektif tablet/mobile, hanya untuk properti yang
// TIDAK di-override eksplisit di breakpoint itu (atau breakpoint yang diwarisinya). Tidak mengubah dokumen, sehingga
// bisa diperbaiki tanpa migrasi. Editor & publish memanggil fungsi yang sama (lewat `buildPageStyles`).

export type ResponsiveBreakpoint = "tablet" | "mobile";

// Row ditumpuk bila konten ≥ 90% lebar tersedia (keputusan T0.8.4: condong menumpuk).
export const STACK_ROWS_SAFETY = 0.9;
// scaleSpacing: hanya spasi literal di atas ambang ini yang diperkecil.
export const SPACING_THRESHOLD_PX = 24;
// scaleType: font literal di atas ambang ini menjadi fluid.
export const TYPE_THRESHOLD_PX = 32;
// scaleType: ukuran di lebar mobile = 75% ukuran desktop, tidak kurang dari 60% (dan tidak di bawah fontMin).
export const TYPE_MOBILE_RATIO = 0.75;
export const TYPE_MIN_RATIO = 0.6;

export interface AutoResult {
  style: Style;
  rules: AutoRuleId[];
  // Deklarasi CSS tambahan yang tidak bisa dinyatakan sebagai Style (mis. `order`, `font-size: clamp()`).
  declarations: Declaration[];
}

export interface AutoResponsiveOutput {
  styleOf(nodeId: string): Style | undefined;
  // Mode editor: "properti ini diatur otomatis" di panel (AC DM-038).
  autoApplied(nodeId: string): AutoRuleId[];
  declarationsOf(nodeId: string): Declaration[];
}

export interface AutoResponsiveOptions {
  fonts?: FontMetrics;
}

/** Pohon ter-resolve satu page di satu breakpoint (sebelum aturan auto). */
export interface ResolvedTree {
  doc: SiteDocument;
  pageId: string;
}

type Path = readonly [group: string, key?: string];

// Override eksplisit di breakpoint `bp` atau breakpoint yang diwarisinya (mobile mewarisi tablet).
function overridden(node: Node, bp: ResponsiveBreakpoint, [group, key]: Path): boolean {
  const layers = bp === "mobile" ? [node.style.tablet, node.style.mobile] : [node.style.tablet];
  return layers.some((patch) => {
    const value = (patch as Record<string, unknown> | undefined)?.[group];
    if (value === undefined) return false;
    if (key === undefined || value === null) return true;
    return typeof value === "object" && value !== null && (value as Record<string, unknown>)[key] !== undefined;
  });
}

const scaleLength = (value: LengthValue | undefined, factor: number): LengthValue | undefined =>
  value && !("$token" in value) && value.unit === "px" && value.value > SPACING_THRESHOLD_PX
    ? { value: Math.round(value.value * factor), unit: "px" }
    : value;

export function applyAutoResponsive(
  tree: ResolvedTree,
  bp: ResponsiveBreakpoint,
  config: SiteSettings["autoResponsive"],
  options: AutoResponsiveOptions = {},
): AutoResponsiveOutput {
  const { doc } = tree;
  const results = new Map<string, AutoResult>();
  const enabled = (rule: AutoRuleId) => config.enabled && config.rules[rule] !== false;
  const scale = config.mobileScale ?? DEFAULT_MOBILE_SCALE;
  const previewWidth = doc.settings.breakpoints.find((breakpoint) => breakpoint.id === bp)?.previewWidth ?? 0;

  const base = new Map<string, Style>();
  const styleOf = (node: Node): Style => {
    const done = results.get(node.id);
    if (done) return done.style;
    let style = base.get(node.id);
    if (!style) {
      style = resolveStyle(node.style, bp, { theme: doc.theme });
      base.set(node.id, style);
    }
    return style;
  };
  const ctx: WidthEstimateContext = { doc, breakpoint: bp, styleOf, fonts: options.fonts ?? DEFAULT_FONT_METRICS };

  const result = (node: Node): AutoResult => {
    let entry = results.get(node.id);
    if (!entry) {
      entry = { style: styleOf(node), rules: [], declarations: [] };
      results.set(node.id, entry);
    }
    return entry;
  };
  const apply = (node: Node, rule: AutoRuleId, patch: (style: Style) => Style) => {
    const entry = result(node);
    entry.style = patch(entry.style);
    if (!entry.rules.includes(rule)) entry.rules.push(rule);
  };

  const children = (node: Node): Node[] =>
    "children" in node
      ? node.children.map((id) => doc.nodes[id]).filter((child): child is Node => child?.visible === true)
      : [];

  // Pra-order: ancestor diproses lebih dulu (lebar tersedia anak memakai hasil aturan ancestor, T0.8.4).
  const visit = (node: Node) => {
    result(node);
    const style = styleOf(node);
    const layout = style.layout;

    // stackRows (mobile) / wrapRowsTablet (tablet): row flex tanpa wrap, ≥ 2 anak alur, bukan tombol, meluber.
    const rowCandidate = isStackRowsCandidate(node, ctx);
    if (rowCandidate) {
      const overflows = () => rowOverflowsStatic(node, previewWidth, ctx, STACK_ROWS_SAFETY);
      if (bp === "mobile" && enabled("stackRows") && !overridden(node, bp, ["layout", "direction"]) && overflows()) {
        apply(node, "stackRows", (current) => ({
          ...current,
          layout: {
            ...(current.layout as Extract<LayoutStyle, { mode: "flex" }>),
            direction: "column",
            align: "stretch",
          },
        }));
        for (const child of children(node)) {
          if (overridden(child, bp, ["size", "width"])) continue;
          apply(child, "stackRows", (current) => ({ ...current, size: { ...current.size, width: { mode: "fill" } } }));
        }
      }
      if (bp === "tablet" && enabled("wrapRowsTablet") && !overridden(node, bp, ["layout", "wrap"]) && overflows()) {
        apply(node, "wrapRowsTablet", (current) => ({
          ...current,
          layout: { ...(current.layout as Extract<LayoutStyle, { mode: "flex" }>), wrap: true },
        }));
      }
    }

    if (bp === "mobile") {
      // fixedToFluid: lebar fixed px melebihi lebar preview → fill dengan max-width nilai asli.
      const width = style.size?.width;
      if (
        enabled("fixedToFluid") &&
        node.type !== "page" &&
        width?.mode === "fixed" &&
        width.unit === "px" &&
        width.value > previewWidth &&
        !overridden(node, bp, ["size", "width"])
      ) {
        apply(node, "fixedToFluid", (current) => ({
          ...current,
          size: { ...current.size, width: { mode: "fill" }, maxWidth: { value: width.value, unit: "px" } },
        }));
      }

      // absoluteToFlow: frame bebas yang lebih lebar dari preview → flex column, anak absolute diurutkan y lalu x.
      if (
        enabled("absoluteToFlow") &&
        node.type === "frame" &&
        layout?.mode === "none" &&
        !overridden(node, bp, ["layout"])
      ) {
        const frameWidth = (() => {
          const fixed =
            style.size?.width?.mode === "fixed"
              ? lengthPx({ value: style.size.width.value, unit: style.size.width.unit }, ctx)
              : null;
          if (fixed !== null) return fixed;
          return Math.max(
            0,
            ...children(node).map((child) => {
              const position = styleOf(child).position;
              return (position?.type === "absolute" ? position.x : 0) + estimateMaxContentWidth(child, ctx);
            }),
          );
        })();
        if (frameWidth > previewWidth) {
          apply(node, "absoluteToFlow", (current) => ({ ...current, layout: { mode: "flex", direction: "column" } }));
          const ordered = children(node)
            .map((child) => ({ child, position: styleOf(child).position }))
            .sort((a, b) => {
              const ay = a.position?.type === "absolute" ? a.position.y : 0;
              const by = b.position?.type === "absolute" ? b.position.y : 0;
              const ax = a.position?.type === "absolute" ? a.position.x : 0;
              const bx = b.position?.type === "absolute" ? b.position.x : 0;
              return ay - by || ax - bx;
            });
          ordered.forEach(({ child }, index) => {
            if (overridden(child, bp, ["position"])) return;
            apply(child, "absoluteToFlow", (current) => {
              const { position: _, ...rest } = current;
              return rest;
            });
            result(child).declarations.push(["order", String(index)]);
          });
        }
      }

      // scaleSpacing: padding/gap literal px > 24 dikali spacingFactor (token: nilai mobile token lewat variabel).
      const flex = styleOf(node).layout;
      if (enabled("scaleSpacing") && flex?.mode === "flex") {
        const factor = scale.spacingFactor;
        const patch: Partial<Extract<LayoutStyle, { mode: "flex" }>> = {};
        if (!overridden(node, bp, ["layout", "gap"])) {
          const gap = scaleLength(flex.gap, factor);
          if (gap !== flex.gap && gap) patch.gap = gap;
          const cross = scaleLength(flex.crossGap, factor);
          if (cross !== flex.crossGap && cross) patch.crossGap = cross;
        }
        if (flex.padding && !overridden(node, bp, ["layout", "padding"])) {
          const padding: Padding = {};
          let changed = false;
          for (const side of ["top", "right", "bottom", "left"] as const) {
            const scaled = scaleLength(flex.padding[side], factor);
            if (scaled) padding[side] = scaled;
            if (scaled !== flex.padding[side]) changed = true;
          }
          if (changed) patch.padding = padding;
        }
        if (Object.keys(patch).length > 0) {
          apply(node, "scaleSpacing", (current) => ({
            ...current,
            layout: { ...(current.layout as Extract<LayoutStyle, { mode: "flex" }>), ...patch },
          }));
        }
      }

      // scaleType: fontSize literal px > 32 → clamp() fluid (token typography memakai nilai mobile token).
      const typography = styleOf(node).typography;
      const fontSize = typography && !("$token" in typography) ? typography.fontSize : undefined;
      if (
        enabled("scaleType") &&
        fontSize &&
        !("$token" in fontSize) &&
        fontSize.unit === "px" &&
        fontSize.value > TYPE_THRESHOLD_PX &&
        !overridden(node, bp, ["typography", "fontSize"])
      ) {
        const min = Math.max(scale.fontMin, Math.round(fontSize.value * TYPE_MIN_RATIO));
        const fluid = Math.round(((fontSize.value * TYPE_MOBILE_RATIO) / previewWidth) * 10000) / 100;
        const entry = result(node);
        entry.declarations.push(["font-size", `clamp(${min}px, ${fluid}vw, ${fontSize.value}px)`]);
        if (!entry.rules.includes("scaleType")) entry.rules.push("scaleType");
      }
    }

    for (const child of children(node)) visit(child);
  };

  const page = doc.nodes[tree.pageId];
  if (page) visit(page);

  return {
    styleOf: (nodeId) => results.get(nodeId)?.style,
    autoApplied: (nodeId) => results.get(nodeId)?.rules ?? [],
    declarationsOf: (nodeId) => results.get(nodeId)?.declarations ?? [],
  };
}
