import type { AssetEntry, Node } from "@platform/document-model";
import type { RenderEnv } from "@platform/renderer";
import { createContext } from "react";
import { assetUrl } from "./asset-url";
import { renderLucideIcon } from "./lucide-icon";

/** Lingkungan render editor untuk satu frame breakpoint; NodeView anak menerima env turunan lewat prop. */
export function createEditorRenderEnv(options: {
  pageId: string;
  breakpoint: RenderEnv["ctx"]["breakpoint"];
  node: (id: string) => Node | undefined;
  asset: (id: string) => AssetEntry | undefined;
}): RenderEnv {
  return {
    ctx: { pageId: options.pageId, breakpoint: options.breakpoint, mode: "editor", assetUrl, icon: renderLucideIcon },
    node: options.node,
    asset: options.asset,
    // Link di canvas tidak bernavigasi (ED-017), jadi id anchor tidak dibutuhkan; menghitungnya butuh scan dokumen.
    isAnchorTarget: () => false,
    insideLink: false,
  };
}

export const RenderEnvContext = createContext<RenderEnv | null>(null);
