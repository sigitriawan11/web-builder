import type { Breakpoint } from "@platform/document-model";
import { BASE_CSS, buildPageStyles, render } from "@platform/renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { fixtureFromSearch } from "../canvas/dev-fixture";
import { DEFAULT_PREVIEW_WIDTHS } from "../canvas/frames/frame-layout";
import { breakpointFromSearch } from "../store/breakpoint-store";

// T2.19.2 / ED-240: harness uji paritas WYSIWYG (dev/e2e saja). Merender output PUBLISH (statis) satu fixture di
// iframe, dengan `data-node-id` tiap elemen agar e2e bisa mencocokkan geometri & computed style dengan canvas editor.
// Lebar iframe = lebar frame breakpoint (dari `?w=`) sehingga media query publish resolve ke breakpoint yang sama.

const assetUrl = (assetId: string) => `/_assets/${assetId}`;

function publishDocument(search: string): {
  html: string;
  width: number;
  height: number;
  breakpoint: Breakpoint;
} {
  const doc = fixtureFromSearch(search);
  // Canvas editor adalah permukaan authoring: ia menampilkan style per-breakpoint yang ditulis, TANPA auto-responsive
  // DM-038 (itu peningkatan saat publish, ditandai badge di editor & terlihat di mode Preview). Agar paritas menguji
  // resolusi cascade (editor inline vs publish media query) dan bukan selisih auto-responsive, nonaktifkan di sini.
  doc.settings = { ...doc.settings, autoResponsive: { ...doc.settings.autoResponsive, enabled: false } };
  const pageId = doc.pageOrder[0] ?? "";
  const breakpoint = breakpointFromSearch(search);
  const params = new URLSearchParams(search);
  const widthParam = Number(params.get("w"));
  const width = Number.isFinite(widthParam) && widthParam > 0 ? widthParam : DEFAULT_PREVIEW_WIDTHS[breakpoint];
  // Tinggi iframe = tinggi viewport editor (`?h=`) agar unit `vh` resolve ke tinggi yang sama di kedua sisi.
  const heightParam = Number(params.get("h"));
  const height = Number.isFinite(heightParam) && heightParam > 0 ? heightParam : 900;
  const styles = buildPageStyles(doc, { pageId, assetUrl, target: "publish" });
  const markup = renderToStaticMarkup(
    render(doc, {
      pageId,
      breakpoint: "base",
      mode: "publish",
      assetUrl,
      className: (node) => styles.classOf(node.id),
      nodeAttributes: (node) => ({ "data-node-id": node.id }),
    }),
  );
  const html = `<!doctype html><html lang="${doc.settings.language}"><head><meta charset="utf-8"><style>html,body{margin:0}${BASE_CSS}${styles.css}</style></head><body>${markup}</body></html>`;
  return { html, width, height, breakpoint };
}

export function WysiwygHarness() {
  if (!import.meta.env.DEV) {
    window.location.replace("/sites");
    return null;
  }
  const { html, width, height, breakpoint } = publishDocument(window.location.search);
  return (
    <iframe
      // biome-ignore lint/plugin: harness dev/e2e saja (bukan UI pengguna), judul tak perlu i18n.
      title="wysiwyg-publish"
      data-testid="wys-publish"
      data-breakpoint={breakpoint}
      srcDoc={html}
      style={{ width, height, border: 0, display: "block" }}
    />
  );
}
