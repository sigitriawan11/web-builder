import { ancestors } from "../query/tree";
import { walkJsonObjects } from "../query/walk-json";
import type { Node, SiteDocument } from "../schema";
import type { Issue } from "./issues";

// Lint semantik DM-009: WARNING (bukan error validasi) — dokumen tetap valid; editor/AI menampilkan saran.

// Hasil lint memakai format `Issue` (kode stabil + pesan id/en) agar bisa digabung dengan `validateDocument`.
export type LintWarning = Issue & { pageId: string; nodeId: string };

const headingLevel = (node: Node): number | null => {
  if (node.type !== "text" || !node.tag || !/^h[1-6]$/.test(node.tag)) return null;
  return Number(node.tag.slice(1));
};

// Tag efektif (DM-009): `tag` eksplisit atau default per tipe.
const DEFAULT_TAG: Record<Node["type"], string> = {
  page: "main",
  frame: "div",
  text: "p",
  image: "img",
  shape: "div",
  icon: "span",
};
const effectiveTag = (node: Node): string => node.tag ?? DEFAULT_TAG[node.type];

/** Node page dalam urutan DOM (depth-first mengikuti `children`). */
function* inDomOrder(doc: SiteDocument, pageId: string): Generator<Node> {
  const stack = [pageId];
  while (stack.length > 0) {
    const node = doc.nodes[stack.pop() ?? ""];
    if (!node) continue;
    yield node;
    if ("children" in node) stack.push(...[...node.children].reverse());
  }
}

// DM-009: tidak boleh ada elemen interaktif bersarang — link di dalam frame berlink dirender renderer sebagai <span>.
function hasOwnLink(node: Node): boolean {
  if (node.type === "frame" || node.type === "image") return node.props.link !== undefined;
  if (node.type !== "text") return false;
  let found = false;
  walkJsonObjects(node.props.content, [], (object) => {
    if (object.type === "link") found = true;
    return found;
  });
  return found;
}

function linkedAncestor(doc: SiteDocument, node: Node): boolean {
  return ancestors(doc, node.id).some((ancestor) => ancestor.type === "frame" && ancestor.props.link !== undefined);
}

export function lintDocument(doc: SiteDocument): LintWarning[] {
  const warnings: LintWarning[] = [];
  for (const pageId of doc.pageOrder) {
    let h1Count = 0;
    let previousLevel = 0;
    let mainCount = 0;
    for (const node of inDomOrder(doc, pageId)) {
      const tag = effectiveTag(node);
      // DM-009: `main` maksimal satu per page (page = wrapper `main`, dihitung pertama).
      if (tag === "main" && ++mainCount > 1) {
        warnings.push({
          code: "MULTIPLE_MAIN",
          path: ["nodes", node.id, "tag"],
          pageId,
          nodeId: node.id,
          message: { id: "Lebih dari satu <main> di halaman ini", en: "More than one <main> on this page" },
        });
      }
      // DM-009: `li` hanya boleh langsung di dalam `ul`/`ol`.
      if (tag === "li") {
        const parent = node.parentId ? doc.nodes[node.parentId] : undefined;
        const parentTag = parent ? effectiveTag(parent) : undefined;
        if (parentTag !== "ul" && parentTag !== "ol") {
          warnings.push({
            code: "LI_OUTSIDE_LIST",
            path: ["nodes", node.id, "tag"],
            pageId,
            nodeId: node.id,
            message: {
              id: "<li> harus berada langsung di dalam <ul> atau <ol>",
              en: "<li> must be a direct child of <ul> or <ol>",
            },
          });
        }
      }
      const level = headingLevel(node);
      if (level !== null) {
        if (level === 1 && ++h1Count > 1) {
          warnings.push({
            code: "MULTIPLE_H1",
            path: ["nodes", node.id, "tag"],
            pageId,
            nodeId: node.id,
            message: { id: "Lebih dari satu h1 di halaman ini", en: "More than one h1 on this page" },
          });
        }
        if (previousLevel > 0 && level > previousLevel + 1) {
          warnings.push({
            code: "HEADING_SKIP",
            path: ["nodes", node.id, "tag"],
            pageId,
            nodeId: node.id,
            message: {
              id: `Heading melompat dari h${previousLevel} ke h${level}`,
              en: `Heading skips from h${previousLevel} to h${level}`,
            },
          });
        }
        previousLevel = level;
      }
      if (hasOwnLink(node) && linkedAncestor(doc, node)) {
        warnings.push({
          code: "NESTED_LINK",
          path: ["nodes", node.id],
          pageId,
          nodeId: node.id,
          message: {
            id: "Link di dalam frame berlink tidak bisa diklik terpisah (dirender sebagai teks biasa)",
            en: "A link inside a linked frame cannot be clicked separately (rendered as plain content)",
          },
        });
      }
      if (node.type === "image" && !node.props.decorative && !node.props.image.alt?.trim()) {
        warnings.push({
          code: "IMAGE_MISSING_ALT",
          path: ["nodes", node.id, "props", "image", "alt"],
          pageId,
          nodeId: node.id,
          message: {
            id: "Gambar tanpa teks alternatif (tandai dekoratif bila hanya hiasan)",
            en: "Image has no alternative text (mark it decorative if purely ornamental)",
          },
        });
      }
    }
  }
  return warnings;
}
