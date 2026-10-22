import { type ComponentDefinition, createBlankSiteDocument, type SiteDocument } from "@platform/document-model";
import { renderToStaticHtml, type StaticPage } from "./index";

// CMP-014: HTML statis (responsif) satu instance component dengan propValues DEFAULT → di-screenshot per breakpoint
// oleh renderer-service. Dibungkus dalam SiteDocument sintetis (satu page home berisi satu instance) agar bisa lewat
// `renderToStaticHtml` (resolusi $prop → default + CSS responsif media-query sekali render untuk ketiga breakpoint).

const PREVIEW_INSTANCE_ID = "n_cmppreview01";

export interface ComponentPreviewOptions {
  assetUrl: (assetId: string) => string;
}

export function renderComponentPreview(definition: ComponentDefinition, options: ComponentPreviewOptions): StaticPage {
  const base = createBlankSiteDocument({ title: definition.name, language: "en" });
  const pageId = base.pageOrder[0];
  if (!pageId) throw new Error("renderComponentPreview: page home tidak ada");
  const page = base.nodes[pageId];
  if (page?.type !== "page") throw new Error("renderComponentPreview: node home bukan page");

  const doc: SiteDocument = {
    ...base,
    componentDeps: { [definition.id]: { version: definition.version, source: "library" } },
    nodes: {
      ...base.nodes,
      [pageId]: { ...page, children: [PREVIEW_INSTANCE_ID] },
      [PREVIEW_INSTANCE_ID]: {
        id: PREVIEW_INSTANCE_ID,
        type: "instance",
        name: definition.name,
        parentId: pageId,
        visible: true,
        locked: false,
        style: { base: {} },
        props: { componentId: definition.id, version: definition.version },
      },
    },
  };

  return renderToStaticHtml(doc, pageId, {
    assetUrl: options.assetUrl,
    component: (componentId, version) =>
      componentId === definition.id && version === definition.version ? definition : undefined,
  });
}
