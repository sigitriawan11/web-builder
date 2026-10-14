import { resolveStyle, type SiteDocument, type Style } from "@platform/document-model";
import {
  childLayoutOf,
  type Declaration,
  nodeDeclarations,
  type ParentLayout,
  styleDeclarations,
} from "./declarations";
import { tokenDeclarations, usedTokens } from "./tokens";

// PUB-026 (rekomendasi OPEN #2): class per style-signature — deklarasi node diserialisasi kanonik → hash pendek →
// `s-<hash6>`; node dengan deklarasi identik berbagi satu class (dedup). Hash berbasis isi → nama class stabil antar
// publish bila style tidak berubah (cache aset bertahan).

export interface PageStyles {
  // Class node (undefined bila node tanpa deklarasi atau tidak dirender).
  classOf: (nodeId: string) => string | undefined;
  // `:root { --t-… }` (token terpakai) + aturan class base. Media query breakpoint: T1.10.3.
  css: string;
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

export function buildPageStyles(
  doc: SiteDocument,
  options: { pageId: string; assetUrl: (assetId: string) => string },
): PageStyles {
  const classByNode = new Map<string, string>();
  const classBySignature = new Map<string, string>();
  const rules: string[] = [];

  const assign = (nodeId: string, declarations: Declaration[]) => {
    if (declarations.length === 0) return;
    const signature = JSON.stringify(declarations);
    let className = classBySignature.get(signature);
    if (!className) {
      className = `s-${hash(signature)}`;
      // Tabrakan hash (signature beda, class sama) → sufiks berurutan; deterministik untuk dokumen yang sama.
      for (let suffix = 2; [...classBySignature.values()].includes(className); suffix++) {
        className = `s-${hash(signature)}${suffix}`;
      }
      classBySignature.set(signature, className);
      rules.push(declarationsToCss(`.${className}`, declarations));
    }
    classByNode.set(nodeId, className);
  };

  const visit = (nodeId: string, parent: ParentLayout) => {
    const node = doc.nodes[nodeId];
    if (!node?.visible) return;
    const style: Style = resolveStyle(node.style, "base", { theme: doc.theme });
    const ctx = { parent, theme: doc.theme, assetUrl: options.assetUrl };
    assign(nodeId, [...nodeDeclarations(node, style), ...styleDeclarations(style, ctx)]);
    if ("children" in node) for (const childId of node.children) visit(childId, childLayoutOf(style));
  };
  visit(options.pageId, "block");

  const tokens = tokenDeclarations(doc.theme, usedTokens(doc));
  const root = tokens.base.length > 0 ? declarationsToCss(":root", tokens.base) : "";
  return { classOf: (nodeId) => classByNode.get(nodeId), css: root + rules.join("") };
}
