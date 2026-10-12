import type { ReactNode } from "react";
import { NodeView } from "./NodeView";
import { PROTOTYPE_TOKEN_STYLE } from "./tokens";

// Pembungkus canvas: menyediakan CSS variable token untuk isi dokumen.
export function RenderScope({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <div className={className ? `render-root ${className}` : "render-root"} style={PROTOTYPE_TOKEN_STYLE}>
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
