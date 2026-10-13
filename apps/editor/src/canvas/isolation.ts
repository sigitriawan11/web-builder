// Spike M0 (ED-016, ❓ OPEN 02#2): cara mengisolasi CSS situs dari chrome editor.
// - "shadow": isi canvas di shadow root `#world` (Opsi A, T0.4.3).
// - "prefix": isi canvas di `.pf-root`, CSS situs di-scope ke sana (Opsi B, T0.4.4).
// - "none": tanpa isolasi; hanya pembanding untuk membuktikan kebocoran di test.
// Keputusan final di T0.8.1.
export const ISOLATION_MODES = ["shadow", "prefix", "none"] as const;
export type IsolationMode = (typeof ISOLATION_MODES)[number];

export const DEFAULT_ISOLATION: IsolationMode = "shadow";

export function isolationFromSearch(search: string): IsolationMode {
  const value = new URLSearchParams(search).get("isolation");
  return ISOLATION_MODES.find((mode) => mode === value) ?? DEFAULT_ISOLATION;
}

// Shadow root tidak memutus pewarisan (font, warna, line-height dari chrome tetap masuk),
// jadi host di-reset ke nilai awal CSS sebelum style situs berlaku.
export const SHADOW_HOST_CSS = ":host { all: initial; display: block; }";

// Opsi B: pembungkus isi canvas. `all: initial` memutus pewarisan font/warna dari chrome editor,
// sama seperti `:host` di Opsi A. Aturan global editor yang tidak di-scope tetap bisa menembus.
export const PREFIX_ROOT_CLASS = "pf-root";
export const PREFIX_ROOT_CSS = `.${PREFIX_ROOT_CLASS} { all: initial; display: block; }`;

/**
 * Opsi B: batasi setiap selector CSS situs ke dalam `scope` agar tidak menyentuh chrome editor.
 * SEMENTARA (spike): hanya aturan selector biasa; @media/@keyframes/@font-face belum ditangani.
 * Renderer sungguhan menghasilkan CSS ber-scope sendiri.
 */
export function scopeCss(css: string, scope: string): string {
  return css.replace(/([^{}]+)\{/g, (_, selectorList: string) => {
    const scoped = selectorList
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => (selector === "*" ? `${scope}, ${scope} *` : `${scope} ${selector}`));
    const leadingSpace = /^\s*/.exec(selectorList)?.[0] ?? "";
    return `${leadingSpace}${scoped.join(", ")} {`;
  });
}

// CSS dasar ProseMirror (ED-115). Tiptap menyuntikkan CSS-nya ke document.head, yang tidak berlaku
// di dalam shadow root, jadi CSS ini selalu ikut stylesheet canvas.
export const TEXT_EDITOR_CSS =
  ".ProseMirror { white-space: pre-wrap; word-wrap: break-word; outline: none; } " +
  ".ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 " +
  "{ margin: 0; font: inherit; }";

// Stylesheet yang dipasang bersama isi canvas untuk tiap mode.
export function canvasStyleSheet(mode: IsolationMode, siteCss: string): string {
  switch (mode) {
    case "shadow":
      return [SHADOW_HOST_CSS, TEXT_EDITOR_CSS, siteCss].join("\n");
    case "prefix": {
      const scope = `.${PREFIX_ROOT_CLASS}`;
      return [PREFIX_ROOT_CSS, scopeCss(TEXT_EDITOR_CSS, scope), scopeCss(siteCss, scope)].join("\n");
    }
    case "none":
      return [TEXT_EDITOR_CSS, siteCss].join("\n");
  }
}

// Fixture AC ED-016: CSS situs agresif tidak boleh merusak UI editor.
const SITE_CSS_FIXTURES: Record<string, string> = {
  // `letter-spacing` = penanda kebocoran yang unik di semua browser (font default Firefox memang serif).
  aggressive: "* { box-sizing: content-box; font-family: serif; letter-spacing: 7px; }",
};

// SEMENTARA: situs belum punya CSS kustom (DM-034 melarang customCss di M1–M8); ini hanya untuk eksperimen.
export function siteCssFromSearch(search: string): string {
  const name = new URLSearchParams(search).get("siteCss");
  return (name && SITE_CSS_FIXTURES[name]) || "";
}
