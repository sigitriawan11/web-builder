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
export {
  BASE_CSS,
  BASE_FONT_FAMILY,
  BASE_FONT_TOKEN,
  breakpointScopeClasses,
  buildPageStyles,
  declarationsToCss,
  type PageStyles,
  type PageStylesOptions,
  type StyleTarget,
} from "./css/stylesheet";
export { type TokenDeclarations, tokenDeclarations, usedTokens } from "./css/tokens";
export { colorToCss, cssString, lengthToCss, tokenVar, tokenVarName, typographyVarName } from "./css/values";
export {
  anchorId,
  anchorTargets,
  type LinkAttributes,
  linkAttributes,
  linkHref,
  type NodeSource,
  nodeLookup,
} from "./links";
export { Box, Image, Link, Text } from "./primitives";
export {
  childRenderEnv,
  createRenderEnv,
  type RenderEnv,
  type RenderNodeOptions,
  render,
  renderNodeElement,
} from "./render";
export {
  type AutoResponsiveOptions,
  type AutoResponsiveOutput,
  type AutoResult,
  applyAutoResponsive,
  type ResolvedTree,
  type ResponsiveBreakpoint,
  SPACING_THRESHOLD_PX,
  STACK_ROWS_SAFETY,
  TYPE_MIN_RATIO,
  TYPE_MOBILE_RATIO,
  TYPE_THRESHOLD_PX,
} from "./responsive/auto-responsive";
export {
  DEFAULT_FONT_METRICS,
  estimateAvailableWidth,
  estimateMaxContentWidth,
  type FontMetrics,
  flowChildCount,
  isStackRowsCandidate,
  lengthPx,
  rowOverflowsStatic,
  type WidthEstimateContext,
} from "./responsive/estimate-width";
export { renderRichText } from "./rich-text";
export { escapeHtml, renderToStaticHtml, type StaticPage, type StaticRenderOptions } from "./static";
