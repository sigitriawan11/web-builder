import type { ComponentDefinition, SiteDocument } from "@platform/document-model";
import { renderToStaticMarkup } from "react-dom/server";
import { BASE_CSS, buildPageStyles } from "../css/stylesheet";
import { render } from "../render";

// DM-001 / PUB-025 / spec 07 §4.1: HTML statis satu page (Node, tanpa API browser). React hanya dipakai di build
// time; output tanpa runtime React, hydration marker, atau atribut editor (PUB-049). Deterministik: input sama →
// byte-identik (dedup & cache).

export interface StaticRenderOptions {
  assetUrl: (assetId: string) => string;
  // Origin situs (mis. `https://tokobudi.com`) untuk canonical & og:url; tanpa = tidak dibuat.
  baseUrl?: string;
  // DM-051: registry definisi component (publish pipeline menyediakan dari DB). Tanpa ini, instance = placeholder.
  component?: (componentId: string, version: number) => ComponentDefinition | undefined;
}

export interface StaticPage {
  html: string;
  // CSS halaman (sudah di-inline di `<style>`); dipisah untuk file `page-<slug>.css` saat > batas critical (M4).
  css: string;
}

// Teks konten situs (bukan UI platform): mengikuti bahasa situs, bukan @platform/i18n (renderer tidak boleh
// bergantung pada paket UI, ARCHITECTURE §4.3). Bahasa lain → Inggris.
const SKIP_LINK: Record<string, string> = { id: "Lewati ke konten", en: "Skip to content" };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const meta = (attribute: "name" | "property", key: string, content: string) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;

// CSS dibangun generator sendiri (string CSS sudah meng-escape `<`); penjaga terakhir agar tidak menutup <style>.
const safeStyle = (css: string) => css.replace(/<\/(style)/gi, "<\\/$1");

// Skip link (PUB-047): tersembunyi secara visual sampai mendapat fokus keyboard.
const SKIP_CSS =
  ".pf-skip{position:absolute;left:-9999px;top:0}" +
  ".pf-skip:focus{left:8px;top:8px;z-index:1000;padding:8px 12px;background:#fff;color:#000}";

const absolute = (baseUrl: string | undefined, path: string) =>
  baseUrl ? `${baseUrl.replace(/\/+$/, "")}${path}` : undefined;

/** HTML statis satu page + CSS-nya. Melempar bila `pageId` bukan page dokumen. */
export function renderToStaticHtml(doc: SiteDocument, pageId: string, options: StaticRenderOptions): StaticPage {
  const page = doc.nodes[pageId];
  if (page?.type !== "page") throw new Error(`renderToStaticHtml: "${pageId}" bukan page`);
  const { settings } = doc;
  const seo = page.props.seo ?? {};

  const styles = buildPageStyles(doc, {
    pageId,
    assetUrl: options.assetUrl,
    ...(options.component ? { component: options.component } : {}),
  });
  const body = renderToStaticMarkup(
    render(doc, {
      pageId,
      breakpoint: "base",
      mode: "publish",
      assetUrl: options.assetUrl,
      className: (node) => styles.classOf(node.id),
      ...(options.component ? { component: options.component } : {}),
      // Target skip link; `htmlId` page (bila ada) tetap dipakai.
      nodeAttributes: (node) => (node.id === pageId && !node.htmlId ? { id: "main" } : undefined),
    }),
  );
  const mainId = page.htmlId ?? "main";

  // Home tanpa judul SEO khusus memakai judul default situs apa adanya (tanpa template).
  const title =
    page.props.isHome && !seo.title
      ? settings.seo.defaultTitle
      : settings.seo.titleTemplate.replace("%s", seo.title ?? page.props.title);
  const description = seo.description ?? settings.seo.defaultDescription;
  const noIndex = seo.noIndex === true || settings.seo.noIndex === true;
  const canonical = seo.canonical ?? absolute(options.baseUrl, page.props.path);
  const ogImage = seo.ogImage ?? settings.seo.ogImage;
  const language = settings.language;
  const css = BASE_CSS + SKIP_CSS + styles.css;

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    description ? meta("name", "description", description) : "",
    noIndex ? meta("name", "robots", "noindex") : "",
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "",
    meta("property", "og:type", "website"),
    meta("property", "og:title", title),
    description ? meta("property", "og:description", description) : "",
    canonical ? meta("property", "og:url", canonical) : "",
    ogImage ? meta("property", "og:image", options.assetUrl(ogImage.assetId)) : "",
    meta("name", "twitter:card", ogImage ? "summary_large_image" : "summary"),
    settings.favicon ? `<link rel="icon" href="${escapeHtml(options.assetUrl(settings.favicon.assetId))}">` : "",
    meta("name", "generator", "Platform"),
    `<style>${safeStyle(css)}</style>`,
  ].join("");

  const skip = SKIP_LINK[language.split("-")[0] ?? ""] ?? SKIP_LINK.en ?? "";
  const html =
    `<!doctype html><html lang="${escapeHtml(language)}"><head>${head}</head>` +
    `<body><a class="pf-skip" href="#${escapeHtml(mainId)}">${escapeHtml(skip)}</a>${body}</body></html>`;
  return { html, css };
}
