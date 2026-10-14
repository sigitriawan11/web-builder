import type { SiteDocument } from "../schema";
import { walkJsonObjects } from "./walk-json";

// DM-057: rujukan asset dicari generik (objek ber-`assetId` di props & style node, rich text, settings, theme) agar node
// atau field baru yang memakai AssetRef/LinkValue otomatis ikut diperiksa invariant & gcAssets tanpa daftar manual.

export type AssetRefLocation = { assetId: string; path: (string | number)[] };

type AssetScanInput = Pick<SiteDocument, "nodes" | "settings" | "theme">;

/** Semua rujukan asset dalam dokumen beserta path-nya (untuk pesan error invariant). */
export function collectAssetRefs(doc: AssetScanInput): AssetRefLocation[] {
  const found: AssetRefLocation[] = [];
  const visit = (object: Record<string, unknown>, path: () => (string | number)[]) => {
    if (typeof object.assetId === "string") found.push({ assetId: object.assetId, path: [...path(), "assetId"] });
  };
  for (const node of Object.values(doc.nodes)) {
    walkJsonObjects(node.props, ["nodes", node.id, "props"], visit);
    // Fill gambar (DM-029) di setiap breakpoint.
    walkJsonObjects(node.style, ["nodes", node.id, "style"], visit);
  }
  walkJsonObjects(doc.settings, ["settings"], visit);
  walkJsonObjects(doc.theme, ["theme"], visit);
  return found;
}

/**
 * Buang entri `doc.assets` yang tidak dirujuk (AC DM-057). Dipanggil saat publish & snapshot pada salinan JSON;
 * tidak mengubah input. File fisik tidak disentuh — GC object storage urusan worker (spec 07).
 */
export function gcAssets<T extends AssetScanInput & Pick<SiteDocument, "assets">>(doc: T): T {
  const referenced = new Set(collectAssetRefs(doc).map((ref) => ref.assetId));
  const assets = Object.fromEntries(Object.entries(doc.assets).filter(([assetId]) => referenced.has(assetId)));
  return { ...doc, assets };
}
