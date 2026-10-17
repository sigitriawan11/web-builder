import {
  type AutoRuleId,
  type BreakpointDef,
  resolveStateStyle,
  resolveStyle,
  type SiteDocument,
  type StateName,
  tokenEntry,
} from "@platform/document-model";
import { type AutoResponsiveOptions, applyAutoResponsive } from "../responsive/auto-responsive";
import {
  childLayoutOf,
  type Declaration,
  fixedPx,
  nodeDeclarations,
  type ParentLayout,
  styleDeclarations,
} from "./declarations";
import { tokenDeclarations, usedTokens } from "./tokens";
import { tokenVarName } from "./values";

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
  // Metrik font untuk estimasi `stackRows` (default sampai katalog font M2).
  fonts?: AutoResponsiveOptions["fonts"];
}

export interface PageStyles {
  // Class node (undefined bila node tanpa deklarasi atau tidak dirender).
  classOf: (nodeId: string) => string | undefined;
  css: string;
  // Aturan auto-responsive (DM-038) yang diterapkan ke node di breakpoint — untuk panel editor.
  autoApplied: (nodeId: string, breakpoint: "tablet" | "mobile") => AutoRuleId[];
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

// Font dasar konten situs: teks tanpa `typography` mewarisi token `fontFamily.body` (default theme "Inter"), bukan font
// bawaan browser (sering serif). Sama di editor (RenderScope) & publish (`body`) — WYSIWYG. Hanya font-family: ukuran
// & line-height tetap bawaan agar layout yang ada tidak bergeser. Fallback bila theme tanpa token itu.
export const BASE_FONT_TOKEN = "fontFamily.body";
export const BASE_FONT_FAMILY = `var(${tokenVarName(BASE_FONT_TOKEN)},system-ui,sans-serif)`;

/** Reset minimal global (PUB-026 `global.css`): border-box agar stroke inside tidak mengubah ukuran (DM-030). */
export const BASE_CSS =
  "*,*::before,*::after{box-sizing:border-box}" +
  "body,h1,h2,h3,h4,h5,h6,p,figure,blockquote,ul,ol{margin:0}" +
  "img{max-width:100%}" +
  `body{font-family:${BASE_FONT_FAMILY}}`;

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
  // DM-040: aturan interaction state. hover dibungkus `@media (hover:hover)` (jangan aktif di sentuh); pressed = `:active`.
  const hoverRules: Record<Breakpoint, string[]> = { base: [], tablet: [], mobile: [] };
  const pressedRules: Record<Breakpoint, string[]> = { base: [], tablet: [], mobile: [] };

  type StateDecls = Record<StateName, Record<Breakpoint, Declaration[]>>;
  const STATE_PSEUDO: Record<StateName, { pseudo: string; bucket: Record<Breakpoint, string[]> }> = {
    hover: { pseudo: ":hover", bucket: hoverRules },
    pressed: { pseudo: ":active", bucket: pressedRules },
  };

  const assign = (nodeId: string, perBreakpoint: Record<Breakpoint, Declaration[]>, states: StateDecls | null) => {
    const tablet = overrideDeclarations(perBreakpoint.base, perBreakpoint.tablet);
    const mobile = overrideDeclarations(perBreakpoint.tablet, perBreakpoint.mobile);
    const base = [...asMap(perBreakpoint.base)];
    // Override state per breakpoint (desktop-first), dihitung seperti base. Null bila node tak punya states.
    const stateParts = states
      ? (Object.keys(STATE_PSEUDO) as StateName[]).map((name) => ({
          name,
          base: [...asMap(states[name].base)],
          tablet: overrideDeclarations(states[name].base, states[name].tablet),
          mobile: overrideDeclarations(states[name].tablet, states[name].mobile),
        }))
      : null;
    const hasState = !!stateParts?.some((part) => part.base.length + part.tablet.length + part.mobile.length > 0);
    if (base.length + tablet.length + mobile.length === 0 && !hasState) return;
    // Signature identik dengan sebelum states bila node tak punya state → nama class lama tetap stabil (snapshot).
    const signature = JSON.stringify(hasState ? [base, tablet, mobile, stateParts] : [base, tablet, mobile]);
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
      for (const part of stateParts ?? []) {
        const { pseudo, bucket } = STATE_PSEUDO[part.name];
        if (part.base.length > 0) bucket.base.push(declarationsToCss(`.${className}${pseudo}`, part.base));
        if (part.tablet.length > 0) bucket.tablet.push(declarationsToCss(`.${className}${pseudo}`, part.tablet));
        if (part.mobile.length > 0) bucket.mobile.push(declarationsToCss(`.${className}${pseudo}`, part.mobile));
      }
    }
    classByNode.set(nodeId, className);
  };

  // DM-038: aturan auto-responsive di atas style efektif tablet/mobile — fungsi yang sama untuk editor & publish.
  const tree = { doc, pageId: options.pageId };
  const fonts = options.fonts ? { fonts: options.fonts } : {};
  const auto = {
    tablet: applyAutoResponsive(tree, "tablet", doc.settings.autoResponsive, fonts),
    mobile: applyAutoResponsive(tree, "mobile", doc.settings.autoResponsive, fonts),
  };

  type ParentBox = { width?: number | undefined; height?: number | undefined };
  // Arti `fill` bergantung arah parent DI BREAKPOINT YANG SAMA (mis. row di desktop, stack di mobile).
  const visit = (
    nodeId: string,
    parents: Record<Breakpoint, ParentLayout>,
    parentBoxes: Record<Breakpoint, ParentBox>,
  ) => {
    const node = doc.nodes[nodeId];
    if (!node?.visible) return;
    const declarations = {} as Record<Breakpoint, Declaration[]>;
    const childParents = {} as Record<Breakpoint, ParentLayout>;
    const childBoxes = {} as Record<Breakpoint, ParentBox>;
    for (const bp of BREAKPOINTS) {
      const style =
        (bp === "base" ? undefined : auto[bp].styleOf(nodeId)) ?? resolveStyle(node.style, bp, { theme: doc.theme });
      const ctx = {
        parent: parents[bp],
        theme: doc.theme,
        assetUrl: options.assetUrl,
        parentWidth: parentBoxes[bp].width,
        parentHeight: parentBoxes[bp].height,
      };
      declarations[bp] = [
        ...nodeDeclarations(node, style),
        ...styleDeclarations(style, ctx),
        ...(bp === "base" ? [] : auto[bp].declarationsOf(nodeId)),
      ];
      childParents[bp] = childLayoutOf(style);
      childBoxes[bp] = { width: fixedPx(style.size?.width), height: fixedPx(style.size?.height) };
    }
    // DM-040: state hanya dirender untuk publish (editor memakai force-preview — task editor terpisah).
    let states: StateDecls | null = null;
    if (target === "publish" && node.style.states) {
      states = { hover: {} as Record<Breakpoint, Declaration[]>, pressed: {} as Record<Breakpoint, Declaration[]> };
      for (const name of Object.keys(STATE_PSEUDO) as StateName[]) {
        for (const bp of BREAKPOINTS) {
          const override = resolveStateStyle(node.style, bp, name, { theme: doc.theme });
          states[name][bp] = styleDeclarations(override, {
            parent: parents[bp],
            theme: doc.theme,
            assetUrl: options.assetUrl,
          });
        }
      }
    }
    assign(nodeId, declarations, states);
    if ("children" in node) for (const childId of node.children) visit(childId, childParents, childBoxes);
  };
  const noBox: Record<Breakpoint, ParentBox> = { base: {}, tablet: {}, mobile: {} };
  visit(options.pageId, { base: "block", tablet: "block", mobile: "block" }, noBox);

  // Variabel token: base di root; varian responsif di breakpoint (token tidak perlu re-render node, PUB-043).
  const used = usedTokens(doc);
  // Font dasar (BASE_FONT_FAMILY) selalu merujuk token ini → variabelnya wajib ikut walau tidak dirujuk node.
  if (tokenEntry(doc.theme, BASE_FONT_TOKEN) !== undefined) used.add(BASE_FONT_TOKEN);
  const tokens = tokenDeclarations(doc.theme, used);
  const rootSelector = options.rootSelector ?? ":root";
  const tokenRule = (bp: Breakpoint) => {
    if (tokens[bp].length === 0) return "";
    if (bp === "base") return declarationsToCss(rootSelector, tokens.base);
    return declarationsToCss(target === "editor" ? `.bp-${bp}` : rootSelector, tokens[bp]);
  };

  // DM-040: hover dibungkus `@media (hover:hover)`. Urutan dalam satu breakpoint: base → :hover → :active
  // (konvensi LVHA; :active menang saat hover+press bersamaan).
  const hoverWrap = (body: string) => (body ? `@media (hover:hover){${body}}` : "");
  const blockFor = (bp: Breakpoint) =>
    rules[bp].join("") + hoverWrap(hoverRules[bp].join("")) + pressedRules[bp].join("");

  // Urutan: base → tablet → mobile (cascade desktop-first); satu blok per breakpoint (PUB-042).
  let css = tokenRule("base") + blockFor("base");
  for (const bp of ["tablet", "mobile"] as const) {
    const body = tokenRule(bp) + blockFor(bp);
    if (!body) continue;
    css += target === "editor" ? body : `${mediaQuery(doc.settings.breakpoints, bp)}{${body}}`;
  }
  return {
    classOf: (nodeId) => classByNode.get(nodeId),
    css,
    autoApplied: (nodeId, breakpoint) => auto[breakpoint].autoApplied(nodeId),
  };
}
