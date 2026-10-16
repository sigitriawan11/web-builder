import type { Breakpoint, Node } from "@platform/document-model";

// ED-017 / DM-001: satu renderer untuk editor & publish; perbedaan mode lewat context, bukan kode render terpisah.
export type RenderMode = "editor" | "publish";

export interface RenderContext {
  pageId: string;
  breakpoint: Breakpoint;
  mode: RenderMode;
  // URL asset dibangun di luar dokumen (DM-057: assetId + CDN base + varian) — publish: CDN, editor: URL upload.
  assetUrl: (assetId: string) => string;
  // Data binding (M7, spec 05); belum dipakai.
  data?: unknown;
  // Kelas CSS per node dari generator CSS (T1.10.2).
  className?: (node: Node) => string | undefined;
  // Hook mode editor (T1.10.9): atribut tambahan per elemen node (mis. `data-node-id`, ref) tanpa import API editor.
  nodeAttributes?: (node: Node) => Record<string, unknown> | undefined;
  // DM-015: SVG inline ikon Lucide by name (publish: dari peta ikon; editor menyuntik lewat `content`).
  icon?: (name: string, strokeWidth?: number) => import("react").ReactNode;
}
