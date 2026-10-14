import { type BreakpointDef, resolveStyle, type SiteDocument } from "@platform/document-model";
import {
  childLayoutOf,
  type Declaration,
  nodeDeclarations,
  type ParentLayout,
  styleDeclarations,
} from "./declarations";
import { tokenDeclarations, usedTokens } from "./tokens";

// PUB-026 (rekomendasi OPEN #2): class per style-signature — deklarasi node diserialisasi kanonik → hash pendek →
// `s-<hash6>`; node dengan deklarasi identik berbagi class (dedup). Hash berbasis isi → nama class stabil antar publish.
// PUB-042 / ADR-013: satu sumber, dua keluaran breakpoint — publish = `@media (max-width)` desktop-first, editor =
// aturan yang sama di-scope ke breakpoint frame canvas (`.bp-tablet …`); berbeda hanya di selector/pembungkus.

const BREAKPOINTS = ["base", "tablet", "mobile"] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];
type Overrides = Exclude<Breakpoint, "base">;

export type StyleTarget = "publish" | "editor";

export interface PageStylesOptions {
  pageId: string;
  assetUrl: (assetId: string) => string;
  // publish (default) = media query; editor = scope class breakpoint frame.
  target?: StyleTarget;
  // Selector variabel token dasar (publish `:root`; editor = elemen pembungkus canvas, mis. `:host`).
  rootSelector?: string;
}

export interface PageStyles {
  // Class node (undefined bila node tanpa deklarasi atau tidak dirender).
  classOf: (nodeId: string) => string | undefined;
  css: string;
}

/** Class scope breakpoint frame editor: frame mobile memuat tablet juga (meniru cascade media query desktop-first). */
export function breakpointScopeClasses(breakpoint: Breakpoint): string {
  if (breakpoint === "base") return "";
  return breakpoint === "tablet" ? "bp-tablet" : "bp-tablet bp-mobile";
}

// FNV-1a 32-bit → base36; tanpa crypto agar jalan sama di Node & browser.
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36).padStart(6, "0").slice(-6);
}

export function declarationsToCss(selector: string, declarations: readonly Declaration[]): string {
  return `${selector}{${declarations.map(([property, value]) => `${property}:${value}`).join(";")}}`;
}

/** Reset minimal global (PUB-026 `global.css`): border-box agar stroke inside tidak mengubah ukuran (DM-030). */
export const BASE_CSS =
  "*,*::before,*::after{box-sizing:border-box}" +
  "body,h1,h2,h3,h4,h5,h6,p,figure,blockquote,ul,ol{margin:0}" +
  "img{max-width:100%}";

// Properti terakhir menang (sama dengan cascade dalam satu aturan).
const asMap = (declarations: readonly Declaration[]) => new Map(declarations);

/**
 * Deklarasi override breakpoint: properti yang berubah/baru dari breakpoint yang diwarisi, dan `revert` untuk
 * properti yang hilang (override `null`) agar kembali ke nilai bawaan browser, bukan nilai base.
 */
function overrideDeclarations(inherited: readonly Declaration[], current: readonly Declaration[]): Declaration[] {
  const before = asMap(inherited);
  const after = asMap(current);
  const out: Declaration[] = [];
  for (const [property, value] of after) if (before.get(property) !== value) out.push([property, value]);
  for (const property of before.keys()) if (!after.has(property)) out.push([property, "revert"]);
  return out;
}

function mediaQuery(breakpoints: readonly BreakpointDef[], id: Overrides): string {
  const maxWidth = breakpoints.find((breakpoint) => breakpoint.id === id)?.maxWidth;
  return `@media (max-width:${maxWidth ?? (id === "tablet" ? 991 : 479)}px)`;
}

export function buildPageStyles(doc: SiteDocument, options: PageStylesOptions): PageStyles {
  const target = options.target ?? "publish";
  const classByNode = new Map<string, string>();
  const classBySignature = new Map<string, string>();
  const rules: Record<Breakpoint, string[]> = { base: [], tablet: [], mobile: [] };

  const assign = (nodeId: string, perBreakpoint: Record<Breakpoint, Declaration[]>) => {
    const tablet = overrideDeclarations(perBreakpoint.base, perBreakpoint.tablet);
    const mobile = overrideDeclarations(perBreakpoint.tablet, perBreakpoint.mobile);
    const base = [...asMap(perBreakpoint.base)];
    if (base.length + tablet.length + mobile.length === 0) return;
    const signature = JSON.stringify([base, tablet, mobile]);
    let className = classBySignature.get(signature);
    if (!className) {
      className = `s-${hash(signature)}`;
      // Tabrakan hash (signature beda, class sama) → sufiks berurutan; deterministik untuk dokumen yang sama.
      const taken = new Set(classBySignature.values());
      for (let suffix = 2; taken.has(className); suffix++) className = `s-${hash(signature)}${suffix}`;
      classBySignature.set(signature, className);
      if (base.length > 0) rules.base.push(declarationsToCss(`.${className}`, base));
      const scoped = (bp: Overrides) => (target === "editor" ? `.bp-${bp} .${className}` : `.${className}`);
      if (tablet.length > 0) rules.tablet.push(declarationsToCss(scoped("tablet"), tablet));
      if (mobile.length > 0) rules.mobile.push(declarationsToCss(scoped("mobile"), mobile));
    }
    classByNode.set(nodeId, className);
  };

  // Arti `fill` bergantung arah parent DI BREAKPOINT YANG SAMA (mis. row di desktop, stack di mobile).
  const visit = (nodeId: string, parents: Record<Breakpoint, ParentLayout>) => {
    const node = doc.nodes[nodeId];
    if (!node?.visible) return;
    const declarations = {} as Record<Breakpoint, Declaration[]>;
    const childParents = {} as Record<Breakpoint, ParentLayout>;
    for (const bp of BREAKPOINTS) {
      const style = resolveStyle(node.style, bp, { theme: doc.theme });
      const ctx = { parent: parents[bp], theme: doc.theme, assetUrl: options.assetUrl };
      declarations[bp] = [...nodeDeclarations(node, style), ...styleDeclarations(style, ctx)];
      childParents[bp] = childLayoutOf(style);
    }
    assign(nodeId, declarations);
    if ("children" in node) for (const childId of node.children) visit(childId, childParents);
  };
  visit(options.pageId, { base: "block", tablet: "block", mobile: "block" });

  // Variabel token: base di root; varian responsif di breakpoint (token tidak perlu re-render node, PUB-043).
  const tokens = tokenDeclarations(doc.theme, usedTokens(doc));
  const rootSelector = options.rootSelector ?? ":root";
  const tokenRule = (bp: Breakpoint) => {
    if (tokens[bp].length === 0) return "";
    if (bp === "base") return declarationsToCss(rootSelector, tokens.base);
    return declarationsToCss(target === "editor" ? `.bp-${bp}` : rootSelector, tokens[bp]);
  };

  // Urutan: base → tablet → mobile (cascade desktop-first); satu blok per breakpoint (PUB-042).
  let css = tokenRule("base") + rules.base.join("");
  for (const bp of ["tablet", "mobile"] as const) {
    const body = tokenRule(bp) + rules[bp].join("");
    if (!body) continue;
    css += target === "editor" ? body : `${mediaQuery(doc.settings.breakpoints, bp)}{${body}}`;
  }
  return { classOf: (nodeId) => classByNode.get(nodeId), css };
}
