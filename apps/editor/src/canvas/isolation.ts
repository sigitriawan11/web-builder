// Spike M0 (ED-016, ❓ OPEN 02#2): cara mengisolasi CSS situs dari chrome editor.
// - "shadow": isi canvas di shadow root `#world` (Opsi A, T0.4.3).
// - "none": tanpa isolasi; hanya pembanding untuk membuktikan kebocoran di test.
// Opsi B (prefix class) menyusul di T0.4.4. Keputusan final di T0.8.1.
export const ISOLATION_MODES = ["shadow", "none"] as const;
export type IsolationMode = (typeof ISOLATION_MODES)[number];

export const DEFAULT_ISOLATION: IsolationMode = "shadow";

export function isolationFromSearch(search: string): IsolationMode {
  const value = new URLSearchParams(search).get("isolation");
  return ISOLATION_MODES.find((mode) => mode === value) ?? DEFAULT_ISOLATION;
}

// Shadow root tidak memutus pewarisan (font, warna, line-height dari chrome tetap masuk),
// jadi host di-reset ke nilai awal CSS sebelum style situs berlaku.
export const SHADOW_HOST_CSS = ":host { all: initial; display: block; }";

// Fixture AC ED-016: CSS situs agresif tidak boleh merusak UI editor.
const SITE_CSS_FIXTURES: Record<string, string> = {
  aggressive: "* { box-sizing: content-box; font-family: serif; }",
};

// SEMENTARA: situs belum punya CSS kustom (DM-034 melarang customCss di M1–M8); ini hanya untuk eksperimen.
export function siteCssFromSearch(search: string): string {
  const name = new URLSearchParams(search).get("siteCss");
  return (name && SITE_CSS_FIXTURES[name]) || "";
}
