import type { SiteDocument } from "@platform/document-model";
import { memo } from "react";
import { renderNode } from "./render-node";
import { PROTOTYPE_TOKEN_STYLE } from "./tokens";

interface RenderRootProps {
  doc: SiteDocument;
  pageId: string;
}

// Pembungkus canvas: menyediakan CSS variable token, lalu merender page aktif.
// Re-render inkremental per node (observe Yjs) menyusul di T0.4.2.
export const RenderRoot = memo(function RenderRoot({ doc, pageId }: RenderRootProps) {
  return (
    <div className="render-root" style={PROTOTYPE_TOKEN_STYLE}>
      {renderNode(doc, pageId)}
    </div>
  );
});
