// @platform/renderer: Document → React (editor & SSR) dan HTML+CSS statis (publish). Tidak boleh import db/ui/ai-tools;
// output deterministik (ARCHITECTURE §4.2).
export type { RenderContext, RenderMode } from "./context";
export {
  childLayoutOf,
  type Declaration,
  type DeclarationContext,
  nodeDeclarations,
  type ParentLayout,
  styleDeclarations,
} from "./css/declarations";
export { BASE_CSS, buildPageStyles, declarationsToCss, type PageStyles } from "./css/stylesheet";
export { type TokenDeclarations, tokenDeclarations, usedTokens } from "./css/tokens";
export { colorToCss, cssString, lengthToCss, tokenVar, tokenVarName, typographyVarName } from "./css/values";
export { anchorId, anchorTargets, type LinkAttributes, linkAttributes, linkHref } from "./links";
export { Box, Image, Link, Text } from "./primitives";
export { render } from "./render";
export { renderRichText } from "./rich-text";
