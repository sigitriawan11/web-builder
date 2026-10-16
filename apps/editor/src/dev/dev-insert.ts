import { AssetEntrySchema, type Node, plainToRichText, YDOC_KEYS } from "@platform/document-model";
import * as Y from "yjs";

// SEMENTARA (T1.15.18, sampai toolbar & tool pembuat node M2 — ED-037): tombol dev "tambah frame/teks/gambar" untuk
// menguji alur end-to-end (buat → simpan → reload). Membuat node lewat command `createNode`, bukan Y.Doc langsung.

export type DevInsertKind = "frame" | "text" | "image";

export interface DevInsertContext {
  pageId: string;
  selectedIds: readonly string[];
  getNode: (id: string) => Node | null;
  // Aset gambar yang sudah terdaftar di dokumen (registerAsset/upload = M2); null → tombol gambar nonaktif.
  imageAssetId: string | null;
}

/**
 * Parent tujuan (mirip ED-037 tanpa pointer): satu node terseleksi yang container (frame/page) → di dalamnya;
 * teks/gambar terseleksi → parent-nya; selain itu page aktif.
 */
export function devInsertParent(ctx: DevInsertContext): string {
  const [only, ...rest] = ctx.selectedIds;
  if (!only || rest.length > 0) return ctx.pageId;
  const node = ctx.getNode(only);
  if (!node) return ctx.pageId;
  if (node.type === "frame" || node.type === "page") return node.id;
  return node.parentId ?? ctx.pageId;
}

/** Input command `createNode` untuk tombol dev; null bila tidak bisa (gambar tanpa aset). */
export function devInsertInput(
  kind: DevInsertKind,
  ctx: DevInsertContext,
  label: string,
): Record<string, unknown> | null {
  const parentId = devInsertParent(ctx);
  switch (kind) {
    case "frame":
      // Frame kosong ber-hug tidak terlihat → tinggi tetap + isian + auto-layout kolom agar anak langsung rapi.
      return {
        parentId,
        type: "frame",
        style: {
          base: {
            size: { width: { mode: "fill" }, height: { mode: "fixed", value: 160, unit: "px" } },
            layout: {
              mode: "flex",
              direction: "column",
              gap: { value: 12, unit: "px" },
              padding: {
                top: { value: 24, unit: "px" },
                right: { value: 24, unit: "px" },
                bottom: { value: 24, unit: "px" },
                left: { value: 24, unit: "px" },
              },
            },
            fills: [{ type: "solid", color: "#F1F5F9" }],
          },
        },
      };
    case "text":
      return { parentId, type: "text", props: { content: plainToRichText(label) } };
    case "image":
      if (!ctx.imageAssetId) return null;
      return { parentId, type: "image", props: { image: { assetId: ctx.imageAssetId, alt: "" }, fit: "cover" } };
  }
}

/** Aset gambar pertama yang terdaftar di dokumen. */
export function firstImageAsset(doc: Y.Doc): string | null {
  for (const [id, value] of doc.getMap<unknown>(YDOC_KEYS.assets)) {
    const parsed = AssetEntrySchema.safeParse(value instanceof Y.Map ? value.toJSON() : value);
    if (parsed.success && parsed.data.kind === "image") return id;
  }
  return null;
}
