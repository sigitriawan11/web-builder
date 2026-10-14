import { checkLimit, DOCUMENT_LIMITS, type LimitCheck, type LimitName } from "../limits";
import { plainText } from "../query/rich-text";
import { listTokenPaths } from "../query/tokens";
import type { SiteDocument } from "../schema";
import type { IssueMessage, IssueReporter } from "./issues";

// DM-076: batas hard → `LIMITS` (error di semua mode, dijalankan SiteDocumentSchema); batas soft → `LIMIT_WARNING`.
// Kedalaman hard tetap kode `DEPTH` (DM-069); di sini hanya peringatan soft-nya.

const LABELS: Record<LimitName, IssueMessage> = {
  nodesPerPage: { id: "node per page", en: "nodes per page" },
  nodesPerSite: { id: "node per situs", en: "nodes per site" },
  pagesPerSite: { id: "page per situs", en: "pages per site" },
  treeDepth: { id: "kedalaman tree", en: "tree depth" },
  childrenPerContainer: { id: "anak per container", en: "children per container" },
  textCharsPerNode: { id: "karakter teks per node", en: "text characters per node" },
  tokensTotal: { id: "jumlah token theme", en: "total theme tokens" },
  jsonSnapshotBytes: { id: "ukuran snapshot JSON (byte)", en: "JSON snapshot size (bytes)" },
  yDocStateBytes: { id: "ukuran state Yjs (byte)", en: "Yjs state size (bytes)" },
};

/** Pesan informatif untuk pelanggaran batas: nama batas, nilai, dan maksimum. */
export function limitMessage(check: LimitCheck): IssueMessage {
  const label = LABELS[check.limit];
  return check.level === "hard"
    ? {
        id: `Batas ${label.id} terlampaui: ${check.value} (maks ${check.max})`,
        en: `Limit exceeded for ${label.en}: ${check.value} (max ${check.max})`,
      }
    : {
        id: `Mendekati batas ${label.id}: ${check.value} (disarankan ≤ ${check.max})`,
        en: `Approaching the ${label.en} limit: ${check.value} (recommended ≤ ${check.max})`,
      };
}

type Doc = Pick<SiteDocument, "nodes" | "pageOrder" | "theme">;

/**
 * Periksa batas DM-076. `level` memilih yang dilaporkan: `hard` (invariant struktur) atau `soft` (peringatan).
 * Node per page dihitung dari tree tiap page; teks memakai `plainText` (yang dilihat pengunjung).
 */
export function checkDocumentLimits(doc: Doc, level: "hard" | "soft", report: IssueReporter): void {
  const emit = (check: LimitCheck | null, path: (string | number)[]) => {
    if (!check || check.level !== level) return;
    if (check.limit === "treeDepth" && check.level === "hard") return; // dilaporkan sebagai DEPTH
    report(level === "hard" ? "LIMITS" : "LIMIT_WARNING", path, limitMessage(check), {
      limit: check.limit,
      value: check.value,
      max: check.max,
    });
  };

  emit(checkLimit("pagesPerSite", doc.pageOrder.length), ["pageOrder"]);
  emit(checkLimit("nodesPerSite", Object.keys(doc.nodes).length), ["nodes"]);
  emit(checkLimit("tokensTotal", listTokenPaths(doc.theme).length), ["theme", "tokens"]);

  for (const pageId of doc.pageOrder) {
    let count = 0;
    let deepest: { id: string; depth: number } = { id: pageId, depth: 0 };
    const seen = new Set<string>();
    const stack: [string, number][] = [[pageId, 0]];
    while (stack.length > 0) {
      const entry = stack.pop();
      if (!entry || seen.has(entry[0])) continue;
      const [id, depth] = entry;
      seen.add(id);
      const node = doc.nodes[id];
      if (!node) continue;
      count++;
      if (depth > deepest.depth) deepest = { id, depth };
      if ("children" in node) for (const childId of node.children) stack.push([childId, depth + 1]);
    }
    emit(checkLimit("nodesPerPage", count), ["nodes", pageId]);
    if (level === "soft" && deepest.depth <= DOCUMENT_LIMITS.treeDepth.hard) {
      emit(checkLimit("treeDepth", deepest.depth), ["nodes", deepest.id]);
    }
  }

  for (const node of Object.values(doc.nodes)) {
    if ("children" in node) {
      emit(checkLimit("childrenPerContainer", node.children.length), ["nodes", node.id, "children"]);
    }
    if (node.type === "text") {
      emit(checkLimit("textCharsPerNode", plainText(node.props.content).length), [
        "nodes",
        node.id,
        "props",
        "content",
      ]);
    }
  }
}
