import { collectLinkRefs, type LinkValue, type SiteDocument } from "@platform/document-model";
import type { RenderContext } from "./context";

// DM-056: LinkValue → atribut <a>. Skema sudah membatasi href ke http(s); di sini dicek ulang (pertahanan berlapis,
// ARCHITECTURE §12) karena renderer bisa menerima dokumen yang belum divalidasi.

export interface LinkAttributes {
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean;
  // Mode editor: tujuan disimpan sebagai data agar klik di canvas tidak bernavigasi.
  "data-href"?: string;
}

const SAFE_URL = /^https?:\/\//i;

/** ID elemen untuk anchor: `htmlId` bila ada, selain itu ID node (stabil, aman sebagai atribut). */
export function anchorId(doc: Pick<SiteDocument, "nodes">, nodeId: string): string {
  return doc.nodes[nodeId]?.htmlId ?? nodeId;
}

/** Node di page yang menjadi target anchor (butuh atribut `id`). */
export function anchorTargets(doc: Pick<SiteDocument, "nodes">): Set<string> {
  const targets = new Set<string>();
  for (const ref of collectLinkRefs(doc)) {
    if (ref.kind === "anchor") targets.add(ref.targetId);
    else if (ref.anchorNodeId) targets.add(ref.anchorNodeId);
  }
  return targets;
}

function pagePath(doc: Pick<SiteDocument, "nodes">, pageId: string): string | undefined {
  const page = doc.nodes[pageId];
  return page?.type === "page" ? page.props.path : undefined;
}

export function linkHref(link: LinkValue, doc: Pick<SiteDocument, "nodes">, ctx: RenderContext): string | undefined {
  switch (link.type) {
    case "url":
      return SAFE_URL.test(link.href) ? link.href : undefined;
    case "page": {
      const path = pagePath(doc, link.pageId);
      if (path === undefined) return undefined;
      return link.anchorNodeId ? `${path}#${anchorId(doc, link.anchorNodeId)}` : path;
    }
    case "anchor":
      return `#${anchorId(doc, link.nodeId)}`;
    case "email": {
      const subject = link.subject ? `?subject=${encodeURIComponent(link.subject)}` : "";
      return `mailto:${encodeURIComponent(link.to).replace("%40", "@")}${subject}`;
    }
    case "phone":
      return `tel:+${link.phone}`;
    case "whatsapp":
      return `https://wa.me/${link.phone}${link.message ? `?text=${encodeURIComponent(link.message)}` : ""}`;
    case "asset":
      return ctx.assetUrl(link.assetId);
  }
}

export function linkAttributes(link: LinkValue, doc: Pick<SiteDocument, "nodes">, ctx: RenderContext): LinkAttributes {
  const href = linkHref(link, doc, ctx);
  if (href === undefined) return {};
  if (ctx.mode === "editor") return { "data-href": href };
  const external = link.type === "url" ? link.newTab === true : link.type === "whatsapp";
  return {
    href,
    ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    ...(link.type === "asset" ? { download: true } : {}),
  };
}
