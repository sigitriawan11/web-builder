import type { SiteDocument } from "../schema";

// DM-057: rujukan asset dicari generik (objek ber-`assetId` di props node, rich text, settings, theme) agar node
// atau field baru yang memakai AssetRef/LinkValue otomatis ikut diperiksa invariant & gcAssets tanpa daftar manual.

export type AssetRefLocation = { assetId: string; path: (string | number)[] };

type AssetScanInput = Pick<SiteDocument, "nodes" | "settings" | "theme">;

/** Semua rujukan asset dalam dokumen beserta path-nya (untuk pesan error invariant). */
export function collectAssetRefs(doc: AssetScanInput): AssetRefLocation[] {
  const found: AssetRefLocation[] = [];
  const visit = (value: unknown, path: (string | number)[]): void => {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) visit(item, [...path, index]);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "assetId" && typeof child === "string") found.push({ assetId: child, path: [...path, key] });
      else visit(child, [...path, key]);
    }
  };
  for (const node of Object.values(doc.nodes)) visit(node.props, ["nodes", node.id, "props"]);
  visit(doc.settings, ["settings"]);
  visit(doc.theme, ["theme"]);
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
