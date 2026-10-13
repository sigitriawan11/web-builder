// Font website di canvas (ED-016, ED-116, ED-224), spike T0.4.7.
//
// FontFace yang ditambahkan ke `document.fonts` berlaku untuk seluruh dokumen, termasuk shadow root
// canvas. Agar font situs tidak bercampur dengan font chrome editor yang kebetulan bernama sama
// (mis. situs & UI editor sama-sama memakai "Inter"), font situs didaftarkan dengan nama ber-namespace.
export const SITE_FONT_PREFIX = "pf-site ";

// ED-116: fallback bila font gagal dimuat.
export const FALLBACK_FONT_STACK = "system-ui, sans-serif";

export function siteFontFamilyName(family: string): string {
  return `${SITE_FONT_PREFIX}${family}`;
}

// Nilai CSS font-family untuk teks situs: font situs (ber-namespace) lalu fallback.
export function siteFontStack(family: string | null): string {
  return family ? `"${siteFontFamilyName(family)}", ${FALLBACK_FONT_STACK}` : FALLBACK_FONT_STACK;
}

// Spec 07/ED-116: font di-self-host via Fontsource. SEMENTARA: CDN jsDelivr `@latest`; versi
// dikunci & dicerminkan ke CDN platform saat katalog font dibuat (M2).
export function fontsourceUrl(family: string, weight: number, style: "normal" | "italic" = "normal"): string {
  const slug = family.trim().toLowerCase().replace(/\s+/g, "-");
  // ED-224: subset latin saja.
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${weight}-${style}.woff2`;
}

// Weight yang dipakai prototipe: teks biasa & mark tebal (ED-224: hanya weight yang dipakai).
export const SITE_FONT_WEIGHTS = [400, 700] as const;

export interface FontLoadResult {
  loaded: number[];
  failed: number[];
}

/**
 * Memuat weight yang dipakai saja (ED-224). Kegagalan tidak dilempar: teks tetap tampil dengan fallback.
 * `FontFaceCtor` harus berasal dari window pemilik `fonts`: Chromium mengabaikan FontFace buatan
 * window induk yang ditambahkan ke dokumen iframe (temuan T0.4.7, sama seperti jebakan realm T0.4.6).
 */
export async function loadSiteFont(
  fonts: FontFaceSet,
  family: string,
  weights: readonly number[],
  FontFaceCtor: typeof FontFace = FontFace,
): Promise<FontLoadResult> {
  const results = await Promise.allSettled(
    weights.map(async (weight) => {
      const face = new FontFaceCtor(siteFontFamilyName(family), `url(${fontsourceUrl(family, weight)})`, {
        weight: String(weight),
        style: "normal",
        display: "swap",
      });
      fonts.add(face);
      try {
        await face.load();
      } catch (error) {
        fonts.delete(face);
        throw error;
      }
      return weight;
    }),
  );
  const result: FontLoadResult = { loaded: [], failed: [] };
  results.forEach((outcome, index) => {
    const weight = weights[index] ?? 0;
    if (outcome.status === "fulfilled") result.loaded.push(weight);
    else result.failed.push(weight);
  });
  if (result.failed.length > 0) {
    console.warn(`Font situs "${family}" gagal dimuat untuk weight ${result.failed.join(", ")}; memakai fallback.`);
  }
  return result;
}

export function siteFontFromSearch(search: string): string | null {
  const family = new URLSearchParams(search).get("siteFont")?.trim();
  // Nama family Google Fonts/Fontsource: huruf, angka, spasi.
  return family && /^[A-Za-z0-9 ]{1,64}$/.test(family) ? family : null;
}
