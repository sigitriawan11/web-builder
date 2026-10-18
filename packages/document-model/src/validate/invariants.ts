import { DOCUMENT_LIMITS } from "../limits";
import { collectAssetRefs } from "../query/assets";
import { findBrokenLinks } from "../query/links";
import { checkThemeTokens, tokenEntry } from "../query/tokens";
import { walkJsonObjects } from "../query/walk-json";
import type { Node, SiteDocument, StylePatch } from "../schema";
import type { IssueReporter } from "./issues";
import { checkDocumentLimits } from "./limits";

// Invariant lintas node DM-069. Dua kelompok:
// - struktur (`checkStructure`): selalu error, dijalankan `SiteDocumentSchema` — dokumen tanpa ini tidak bisa dipakai;
// - rujukan (`checkReferences`): asset/token/font/link — warning saat edit, error saat publish (DM-068).

/** Kedalaman tree maksimum (DM-069 `DEPTH`, DM-076): page = 0. */
export const MAX_TREE_DEPTH = DOCUMENT_LIMITS.treeDepth.hard;

type DocShape = Pick<SiteDocument, "nodes" | "pageOrder" | "assets" | "theme" | "settings">;

const BREAKPOINTS = ["base", "tablet", "mobile"] as const;

export function checkStructure(doc: DocShape, report: IssueReporter): void {
  const { nodes } = doc;

  for (const [key, node] of Object.entries(nodes)) {
    if (key !== node.id) {
      report("DUPLICATE_ID", ["nodes", key, "id"], {
        id: `Key "${key}" berbeda dengan node.id "${node.id}"`,
        en: `Key "${key}" differs from node.id "${node.id}"`,
      });
    }
  }

  // DM-006: pageOrder dan node page harus bijeksi.
  const pageOrderSet = new Set<string>();
  doc.pageOrder.forEach((pageId, index) => {
    if (pageOrderSet.has(pageId)) {
      report("ROOT_NOT_PAGE", ["pageOrder", index], {
        id: `Page "${pageId}" muncul lebih dari sekali`,
        en: `Page "${pageId}" appears more than once`,
      });
    }
    pageOrderSet.add(pageId);
    if (nodes[pageId]?.type !== "page") {
      report("ROOT_NOT_PAGE", ["pageOrder", index], {
        id: `"${pageId}" bukan node page yang ada di nodes`,
        en: `"${pageId}" is not an existing page node`,
      });
    }
  });

  for (const node of Object.values(nodes)) {
    if (node.type === "page") {
      if (!pageOrderSet.has(node.id)) {
        report("ROOT_NOT_PAGE", ["nodes", node.id], {
          id: `Page "${node.id}" tidak tercantum di pageOrder`,
          en: `Page "${node.id}" is not listed in pageOrder`,
        });
      }
      continue;
    }

    // parentId adalah sumber kebenaran relasi; children parent harus mencantumkan node ini.
    const parent = nodes[node.parentId];
    const at = ["nodes", node.id, "parentId"];
    if (!parent) {
      report("PARENT_MISSING", at, {
        id: `Parent "${node.parentId}" tidak ada`,
        en: `Parent "${node.parentId}" does not exist`,
      });
    } else if (!("children" in parent)) {
      report("CONTAINER_TYPE", at, {
        id: `Parent "${node.parentId}" (${parent.type}) bukan container`,
        en: `Parent "${node.parentId}" (${parent.type}) is not a container`,
      });
    } else if (!parent.children.includes(node.id)) {
      report("CHILD_MISMATCH", at, {
        id: `Parent "${node.parentId}" tidak mencantumkan "${node.id}" di children`,
        en: `Parent "${node.parentId}" does not list "${node.id}" in children`,
      });
    }

    // DM-026: `layout` hanya untuk container (punya `children`).
    if (!("children" in node)) {
      for (const breakpoint of BREAKPOINTS) {
        if (node.style[breakpoint]?.layout != null) {
          report("CONTAINER_TYPE", ["nodes", node.id, "style", breakpoint, "layout"], {
            id: `Node ${node.type} tidak boleh punya layout`,
            en: `A ${node.type} node cannot have a layout`,
          });
        }
      }
    }

    if (node.type === "image") checkNoHug(node, report);

    // DM-012: group tanpa style visual (fills/strokes/layout/padding). Posisi/size/opacity/transform/effects OK.
    if (node.type === "group") {
      for (const breakpoint of BREAKPOINTS) {
        const style = node.style[breakpoint];
        for (const field of ["fills", "strokes", "layout"] as const) {
          if (style?.[field] != null) {
            report("CONTAINER_TYPE", ["nodes", node.id, "style", breakpoint, field], {
              id: `Group tidak boleh punya ${field}`,
              en: `A group node cannot have ${field}`,
            });
          }
        }
      }
    }
  }

  const listedChildren = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (!("children" in node)) continue;
    node.children.forEach((childId, index) => {
      const path = ["nodes", node.id, "children", index];
      if (listedChildren.has(childId)) {
        report("CHILD_MISMATCH", path, {
          id: `Node "${childId}" tercantum lebih dari sekali di children`,
          en: `Node "${childId}" is listed more than once in children`,
        });
      }
      listedChildren.add(childId);
      const child = nodes[childId];
      if (!child) {
        report("CHILD_MISMATCH", path, {
          id: `Child "${childId}" tidak ada di nodes`,
          en: `Child "${childId}" does not exist in nodes`,
        });
      } else if (child.parentId !== node.id) {
        report("CHILD_MISMATCH", path, {
          id: `Child "${childId}" punya parentId "${String(child.parentId)}", bukan "${node.id}"`,
          en: `Child "${childId}" has parentId "${String(child.parentId)}", not "${node.id}"`,
        });
      }
    });
  }

  // DM-010: path unik per situs; tepat satu home dengan path "/"; layout page tetap flex kolom & lebar fill.
  const pathOwners = new Map<string, string>();
  const homes: string[] = [];
  for (const pageId of doc.pageOrder) {
    const page = nodes[pageId];
    if (page?.type !== "page") continue;
    const owner = pathOwners.get(page.props.path);
    if (owner) {
      report("HOME_PAGE", ["nodes", pageId, "props", "path"], {
        id: `Path "${page.props.path}" sudah dipakai "${owner}"`,
        en: `Path "${page.props.path}" is already used by "${owner}"`,
      });
    } else pathOwners.set(page.props.path, pageId);
    if (page.props.isHome) {
      homes.push(pageId);
      if (page.props.path !== "/") {
        report("HOME_PAGE", ["nodes", pageId, "props", "path"], {
          id: `Page home wajib di path "/"`,
          en: `The home page must use path "/"`,
        });
      }
    }
    checkPageLayout(page, report);
  }
  if (homes.length !== 1) {
    report("HOME_PAGE", ["pageOrder"], {
      id: `Harus tepat satu page isHome (ditemukan ${homes.length})`,
      en: `Exactly one page must be isHome (found ${homes.length})`,
    });
  }

  // Telusuri tree tiap page sekali: htmlId unik per page (DM-008) & kedalaman (DEPTH).
  const reachable = new Set<string>();
  for (const pageId of doc.pageOrder) {
    const seenHtmlIds = new Map<string, string>();
    const stack: [string, number][] = [[pageId, 0]];
    while (stack.length > 0) {
      const entry = stack.pop();
      if (!entry) continue;
      const [id, depth] = entry;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const node = nodes[id];
      if (!node) continue;
      if (depth === MAX_TREE_DEPTH + 1) {
        report("DEPTH", ["nodes", id], {
          id: `Kedalaman tree melebihi ${MAX_TREE_DEPTH} level`,
          en: `Tree depth exceeds ${MAX_TREE_DEPTH} levels`,
        });
      }
      if (node.htmlId !== undefined) {
        const owner = seenHtmlIds.get(node.htmlId);
        if (owner) {
          report("HTML_ID_DUPLICATE", ["nodes", id, "htmlId"], {
            id: `htmlId "${node.htmlId}" sudah dipakai "${owner}" di page yang sama`,
            en: `htmlId "${node.htmlId}" is already used by "${owner}" on the same page`,
          });
        } else seenHtmlIds.set(node.htmlId, id);
      }
      if ("children" in node) for (const childId of node.children) stack.push([childId, depth + 1]);
    }
  }

  checkDocumentLimits(doc, "hard", report);

  // Siklus parent-child lolos cek relasi di atas, jadi pastikan semua node terjangkau dari page.
  for (const id of Object.keys(nodes)) {
    if (!reachable.has(id)) {
      report("CYCLE", ["nodes", id], {
        id: `Node "${id}" tidak terhubung ke page mana pun (siklus atau yatim)`,
        en: `Node "${id}" is not connected to any page (cycle or orphan)`,
      });
    }
  }
}

/**
 * Invariant style satu node (dipakai command style sebelum menulis): `layout` hanya untuk container (DM-026),
 * image tidak `hug` (DM-027), layout page tetap flex kolom & lebar fill (DM-010).
 */
export function checkNodeStyle(node: Node, report: IssueReporter): void {
  if (!("children" in node)) {
    for (const breakpoint of BREAKPOINTS) {
      if (node.style[breakpoint]?.layout != null) {
        report("CONTAINER_TYPE", ["nodes", node.id, "style", breakpoint, "layout"], {
          id: `Node ${node.type} tidak boleh punya layout`,
          en: `A ${node.type} node cannot have a layout`,
        });
      }
    }
  }
  if (node.type === "image") checkNoHug(node, report);
  if (node.type === "page") checkPageLayout(node, report);
}

// DM-010: page = tumpukan section vertikal; layout tidak boleh diubah (juga di override breakpoint).
// Field yang tidak diisi = default renderer (flex kolom, lebar fill).
function checkPageLayout(page: Extract<Node, { type: "page" }>, report: IssueReporter): void {
  for (const breakpoint of BREAKPOINTS) {
    const style: StylePatch | undefined = page.style[breakpoint];
    const at = (...rest: string[]) => ["nodes", page.id, "style", breakpoint, ...rest];
    const layout = style?.layout;
    if (layout?.mode != null && layout.mode !== "flex") {
      report("PAGE_LAYOUT", at("layout", "mode"), { id: "Layout page wajib flex", en: "Page layout must be flex" });
    }
    if (layout && "direction" in layout && layout.direction != null && layout.direction !== "column") {
      report("PAGE_LAYOUT", at("layout", "direction"), {
        id: "Layout page wajib kolom",
        en: "Page layout must be a column",
      });
    }
    const width = style?.size?.width;
    if (width != null && width.mode !== "fill") {
      report("PAGE_LAYOUT", at("size", "width"), { id: "Lebar page wajib fill", en: "Page width must be fill" });
    }
  }
}

// DM-027: `hug` hanya untuk container & text; image harus fixed/fill.
function checkNoHug(node: Extract<Node, { type: "image" }>, report: IssueReporter): void {
  for (const breakpoint of BREAKPOINTS) {
    const style: StylePatch | undefined = node.style[breakpoint];
    for (const axis of ["width", "height"] as const) {
      if (style?.size?.[axis]?.mode === "hug") {
        report("SIZE_MODE", ["nodes", node.id, "style", breakpoint, "size", axis], {
          id: `Image tidak boleh memakai ukuran "hug"`,
          en: `Images cannot use "hug" sizing`,
        });
      }
    }
  }
}

export function checkReferences(doc: DocShape, report: IssueReporter): void {
  // DM-057/DM-069 ASSET_REF: setiap assetId yang dirujuk node (termasuk rich text & link), settings, theme terdaftar.
  for (const ref of collectAssetRefs(doc)) {
    if (!(ref.assetId in doc.assets)) {
      report("ASSET_REF", ref.path, {
        id: `Asset "${ref.assetId}" tidak ada di assets`,
        en: `Asset "${ref.assetId}" does not exist in assets`,
      });
    }
  }
  for (const node of Object.values(doc.nodes)) {
    if (node.type !== "image") continue;
    const { assetId } = node.props.image;
    const asset = doc.assets[assetId];
    if (asset && asset.kind !== "image" && asset.kind !== "svg") {
      report("ASSET_KIND", ["nodes", node.id, "props", "image", "assetId"], {
        id: `Asset "${assetId}" bukan gambar (${asset.kind})`,
        en: `Asset "${assetId}" is not an image (${asset.kind})`,
      });
    }
  }

  checkFontFamilies(doc, report);
  // DM-041/DM-042 + DM-069 TOKEN_REF: alias theme ter-resolve; `$token` di node ada di theme.
  checkThemeTokens(doc.theme, report);
  // Ribuan rujukan memakai segelintir token: hasil lookup di-cache per path (tokenEntry memvalidasi literal).
  const tokenExists = new Map<string, boolean>();
  const checkToken = (token: string, path: (string | number)[]) => {
    let exists = tokenExists.get(token);
    if (exists === undefined) {
      exists = tokenEntry(doc.theme, token) !== undefined;
      tokenExists.set(token, exists);
    }
    if (!exists) {
      report("TOKEN_REF", path, {
        id: `Token "${token}" tidak ada di theme`,
        en: `Token "${token}" does not exist in the theme`,
      });
    }
  };
  for (const node of Object.values(doc.nodes)) {
    visitTokenRefs(node.style, ["nodes", node.id, "style"], checkToken);
    visitTokenRefs(node.props, ["nodes", node.id, "props"], checkToken);
  }

  // DM-056: link page/anchor menunjuk page & node yang ada.
  for (const link of findBrokenLinks(doc)) {
    report("BROKEN_LINK", link.path, {
      id: link.message,
      en:
        link.reason === "PAGE_MISSING"
          ? `Link to a page that does not exist`
          : `Anchor target does not exist on the target page`,
    });
  }
}

function visitTokenRefs(
  value: unknown,
  basePath: (string | number)[],
  visit: (token: string, path: (string | number)[]) => void,
): void {
  walkJsonObjects(value, basePath, (object, path) => {
    if (typeof object.$token !== "string") return false;
    visit(object.$token, path());
    return true;
  });
}

// DM-032: family literal (bukan token) wajib terdaftar di `theme.fonts`, agar font pasti termuat saat publish.
// Berlaku untuk `style.typography` di semua breakpoint dan mark `textStyle` rich text.
function checkFontFamilies(doc: DocShape, report: IssueReporter): void {
  const families = new Set(doc.theme.fonts.map((font) => font.family));
  const check = (fontFamily: unknown, path: (string | number)[]) => {
    if (typeof fontFamily === "string" && !families.has(fontFamily)) {
      report("FONT_REF", path, {
        id: `Font "${fontFamily}" tidak terdaftar di theme.fonts`,
        en: `Font "${fontFamily}" is not registered in theme.fonts`,
      });
    }
  };
  for (const node of Object.values(doc.nodes)) {
    for (const breakpoint of BREAKPOINTS) {
      const typography = node.style[breakpoint]?.typography;
      if (typography && !("$token" in typography)) {
        check(typography.fontFamily, ["nodes", node.id, "style", breakpoint, "typography", "fontFamily"]);
      }
    }
    if (node.type === "text") visitTextStyleMarks(node.props.content, ["nodes", node.id, "props", "content"], check);
  }
}

// Telusuri JSON rich text (list bersarang) dan laporkan fontFamily mark `textStyle` beserta path persisnya.
function visitTextStyleMarks(
  value: unknown,
  basePath: (string | number)[],
  check: (fontFamily: unknown, path: (string | number)[]) => void,
): void {
  walkJsonObjects(value, basePath, (object, path) => {
    if (object.type !== "textStyle") return false;
    const attrs = object.attrs;
    if (attrs !== null && typeof attrs === "object" && "fontFamily" in attrs) {
      check(attrs.fontFamily, [...path(), "attrs", "fontFamily"]);
    }
    return true;
  });
}
