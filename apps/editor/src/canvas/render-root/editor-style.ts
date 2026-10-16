import type { Node, Style, Theme } from "@platform/document-model";
import { type Declaration, nodeDeclarations, type ParentLayout, styleDeclarations } from "@platform/renderer";
import type { CSSProperties } from "react";

// ED-017/ED-018: canvas memakai deklarasi CSS yang SAMA dengan publish (`@platform/renderer`), tetapi dipasang inline
// per node: render inkremental (satu NodeView per node) & preview drag (ED-024) tidak perlu membangun ulang stylesheet.

const camel = (property: string) => property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** Deklarasi renderer → objek style React (custom property `--…` dibiarkan apa adanya). */
export function declarationsToStyle(declarations: readonly Declaration[]): CSSProperties {
  const style: Record<string, string> = {};
  for (const [property, value] of declarations) style[property.startsWith("--") ? property : camel(property)] = value;
  return style as CSSProperties;
}

export interface EditorStyleContext {
  parent: ParentLayout;
  theme: Theme;
  assetUrl: (assetId: string) => string;
  // Lebar artboard frame breakpoint; dipakai node page.
  frameWidth: number;
}

/** Style inline node di canvas: deklarasi publish (urutan sama dengan stylesheet) + kebutuhan editor. */
export function editorNodeStyle(node: Node, style: Style, ctx: EditorStyleContext): CSSProperties {
  const css = declarationsToStyle([
    ...nodeDeclarations(node, style),
    ...styleDeclarations(style, { parent: ctx.parent, theme: ctx.theme, assetUrl: ctx.assetUrl }),
  ]);
  return {
    ...css,
    ...(node.type === "page" ? { width: ctx.frameWidth } : {}),
    // DM-039: node tersembunyi tetap ada di DOM editor; atribut `hidden` kalah oleh `display` inline dari layout.
    ...(node.visible ? {} : { display: "none" }),
  };
}
