// URL asset untuk `<img>`/background canvas (DM-057). Di editor situs, asset disajikan API lewat redirect presigned
// (`/api/v1/sites/:siteId/assets/:assetId/content`, ED-161) — origin page (app.*) → proxy → api. Playground (tanpa
// siteId) & asset yang belum siap memakai placeholder netral yang sama.
const PLACEHOLDER_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
  "<rect width='120' height='80' fill='#E7E1D8'/>" +
  "<path d='M0 80 L40 38 L62 58 L82 42 L120 80 Z' fill='#D3CABD'/>" +
  "<circle cx='88' cy='22' r='8' fill='#D3CABD'/></svg>";

const PLACEHOLDER_URL = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

let assetBase: string | null = null;

/** Dipanggil sekali saat editor situs mount (SiteEditor) — mengaktifkan URL asset nyata lewat API. */
export function configureAssetUrl(siteId: string): void {
  assetBase = `/api/v1/sites/${encodeURIComponent(siteId)}/assets`;
}

export function assetUrl(assetId: string): string {
  if (!assetBase || !assetId) return PLACEHOLDER_URL;
  return `${assetBase}/${encodeURIComponent(assetId)}/content`;
}
