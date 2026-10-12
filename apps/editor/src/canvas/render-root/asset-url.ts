// SEMENTARA (spike M0): URL asset dibangun dari assetId + CDN (DM-057) setelah upload ada (M2).
// Sampai saat itu semua gambar memakai placeholder netral yang sama.
const PLACEHOLDER_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
  "<rect width='120' height='80' fill='#E7E1D8'/>" +
  "<path d='M0 80 L40 38 L62 58 L82 42 L120 80 Z' fill='#D3CABD'/>" +
  "<circle cx='88' cy='22' r='8' fill='#D3CABD'/></svg>";

const PLACEHOLDER_URL = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

export function assetUrl(_assetId: string): string {
  return PLACEHOLDER_URL;
}
