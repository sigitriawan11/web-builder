import type { ReactNode } from "react";
import { NodeView } from "./NodeView";
import { PROTOTYPE_TOKEN_STYLE } from "./tokens";

// Pembungkus canvas: menyediakan CSS variable token & font dasar teks situs (DM-041).
const SCOPE_STYLE = { ...PROTOTYPE_TOKEN_STYLE, fontFamily: "var(--fontFamily-body)" };

interface RenderScopeProps {
  children: ReactNode;
  className?: string | undefined;
  // Stack font-family teks situs (T0.4.7); default mengikuti token prototipe.
  fontStack?: string | undefined;
}

export function RenderScope({ children, className, fontStack }: RenderScopeProps) {
  const style = fontStack ? { ...SCOPE_STYLE, "--fontFamily-body": fontStack } : SCOPE_STYLE;
  return (
    <div className={className ? `render-root ${className}` : "render-root"} style={style}>
      {children}
    </div>
  );
}

// Page aktif dirender inkremental dari Y.Doc (butuh NodeStoreContext.Provider di atasnya).
export function RenderRoot({ pageId, scopeClassName }: { pageId: string; scopeClassName?: string | undefined }) {
  return (
    <RenderScope className={scopeClassName}>
      <NodeView id={pageId} parent="block" />
    </RenderScope>
  );
}
