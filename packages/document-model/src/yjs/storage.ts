import * as Y from "yjs";
import { checkByteLimit, type LimitCheck } from "../limits";
import { jsonEqual } from "../query/normalize-overrides";
import { type Node, type SiteDocument, SiteDocumentSchema } from "../schema";
import { cloneJson } from "./clone-json";
import { createSiteYDoc, jsonToYDoc, nodeToYMap, YDOC_KEYS, yDocToJson } from "./mapping";
import { richTextToYXmlFragment, yXmlFragmentToRichText } from "./rich-text";

// DM-061/DM-062: encoding & penyimpanan. Server menyimpan update biner (append) + snapshot state ter-compact +
// snapshot JSON tervalidasi; GC Yjs aktif (`gc = true`) — version history memakai snapshot JSON, bukan `Y.snapshot`.

/**
 * Muat dokumen = snapshot state terbaru + update sesudahnya (urutan seq). Update yang sudah tercakup snapshot aman
 * diulang (Yjs idempoten). `siteId` → `guid` Y.Doc (DM-058).
 */
export function loadDocument(snapshotState: Uint8Array | null, updates: readonly Uint8Array[], siteId?: string): Y.Doc {
  const doc = siteId ? createSiteYDoc(siteId) : new Y.Doc();
  doc.transact(() => {
    if (snapshotState) Y.applyUpdate(doc, snapshotState);
    for (const update of updates) Y.applyUpdate(doc, update);
  });
  return doc;
}

/**
 * Compaction: state baru dari snapshot + update. Berbeda dengan `Y.mergeUpdates`, dokumen dimuat ke Y.Doc dengan GC
 * aktif sehingga konten yang sudah dihapus dibuang (DM-062 — ukuran state tetap sebanding ukuran JSON).
 */
export function compactState(snapshotState: Uint8Array | null, updates: readonly Uint8Array[]): Uint8Array {
  const doc = loadDocument(snapshotState, updates);
  try {
    return Y.encodeStateAsUpdate(doc);
  } finally {
    doc.destroy();
  }
}

/**
 * Ukuran state bila `update` diterapkan — server menolak update yang membuat state > batas DM-076
 * (`yDocStateBytes`). Dihitung dari state hasil merge tanpa menyentuh dokumen aktif.
 */
export function stateSizeAfterUpdate(
  currentState: Uint8Array,
  update: Uint8Array,
): { bytes: number; limit: LimitCheck | null } {
  const bytes = Y.mergeUpdates([currentState, update]).byteLength;
  return { bytes, limit: checkByteLimit("yDocStateBytes", bytes) };
}

export type JsonSnapshot =
  | { json: SiteDocument; invalid: false }
  | { json: unknown; invalid: true; issues: { path: (string | number)[]; message: string }[] };

/**
 * Snapshot JSON (DM-061): hasil validasi gagal TIDAK memblokir — snapshot tetap disimpan dengan `invalid: true`
 * (pemanggil mengirim alert), agar history & fallback korupsi tetap tersedia.
 */
export function createJsonSnapshot(doc: Y.Doc): JsonSnapshot {
  const json = yDocToJson(doc);
  const parsed = SiteDocumentSchema.safeParse(json);
  if (parsed.success) return { json: parsed.data, invalid: false };
  return {
    json,
    invalid: true,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.filter((key): key is string | number => typeof key !== "symbol"),
      message: issue.message,
    })),
  };
}

// ── Restore (diff-apply) ─────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

// Samakan Y.Map berdaun JSON dengan target: set key yang berbeda, hapus key yang tidak ada di target.
function syncLeafMap(yMap: Y.Map<unknown>, target: JsonRecord, keep: readonly string[] = []): void {
  for (const key of [...yMap.keys()]) {
    if (!keep.includes(key) && (!(key in target) || target[key] === undefined)) yMap.delete(key);
  }
  for (const [key, value] of Object.entries(target)) {
    if (value === undefined) continue;
    const current = yMap.get(key);
    const currentJson = current instanceof Y.AbstractType ? current.toJSON() : current;
    if (!jsonEqual(currentJson, value)) yMap.set(key, cloneJson(value));
  }
}

function syncArray(yArray: Y.Array<unknown>, target: readonly unknown[]): void {
  if (jsonEqual(yArray.toJSON(), target)) return;
  yArray.delete(0, yArray.length);
  yArray.insert(
    0,
    target.map((item) => cloneJson(item)),
  );
}

function childMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) return existing;
  const created = new Y.Map<unknown>();
  parent.set(key, created);
  return created;
}

function syncNode(yNode: Y.Map<unknown>, node: Node): void {
  const target = node as unknown as JsonRecord;
  for (const key of [...yNode.keys()]) if (target[key] === undefined) yNode.delete(key);
  for (const [key, value] of Object.entries(target)) {
    if (value === undefined) continue;
    if (key === "children" && Array.isArray(value)) {
      const yChildren = yNode.get(key);
      if (yChildren instanceof Y.Array) syncArray(yChildren, value);
      else yNode.set(key, Y.Array.from(value));
    } else if (key === "style") {
      const yStyle = childMap(yNode, "style");
      const style = value as JsonRecord;
      for (const breakpoint of [...yStyle.keys()]) if (style[breakpoint] === undefined) yStyle.delete(breakpoint);
      for (const [breakpoint, groups] of Object.entries(style)) {
        if (groups !== undefined) syncLeafMap(childMap(yStyle, breakpoint), groups as JsonRecord);
      }
    } else if (key === "props") {
      const yProps = childMap(yNode, "props");
      const props = value as JsonRecord;
      if (node.type === "text") {
        // Rich text: fragment diganti hanya bila isinya berbeda (menjaga riwayat teks bila tak berubah).
        const { content: _, ...rest } = props;
        syncLeafMap(yProps, rest, ["content"]);
        const yContent = yProps.get("content");
        if (!(yContent instanceof Y.XmlFragment) || !jsonEqual(yXmlFragmentToRichText(yContent), node.props.content)) {
          yProps.set("content", richTextToYXmlFragment(node.props.content));
        }
      } else {
        syncLeafMap(yProps, props);
      }
    } else {
      const current = yNode.get(key);
      if (!jsonEqual(current, value)) yNode.set(key, cloneJson(value));
    }
  }
}

/**
 * Restore (DM-061, ARCHITECTURE §7.4): ubah dokumen aktif menjadi `target` sebagai SATU transaksi `origin`
 * (biasanya `systemOrigin(...)`) dengan perubahan granular — bukan mengganti Y.Doc — agar klien terhubung tetap
 * sinkron dan history tetap utuh (restore = update baru).
 */
export function restoreDocument(doc: Y.Doc, target: SiteDocument, origin: unknown): void {
  doc.transact(() => {
    const { schemaVersion, meta, settings, theme, assets, componentDeps, dataSources, pageOrder, nodes } = target;
    syncLeafMap(doc.getMap(YDOC_KEYS.meta), { schemaVersion, ...meta });
    syncLeafMap(doc.getMap(YDOC_KEYS.settings), settings);

    const yTheme = doc.getMap<unknown>(YDOC_KEYS.theme);
    const yTokens = childMap(yTheme, "tokens");
    const tokens = theme.tokens as JsonRecord;
    for (const group of [...yTokens.keys()]) if (tokens[group] === undefined) yTokens.delete(group);
    for (const [group, values] of Object.entries(tokens)) {
      if (values !== undefined) syncLeafMap(childMap(yTokens, group), values as JsonRecord);
    }
    const yFonts = yTheme.get("fonts");
    if (yFonts instanceof Y.Array) syncArray(yFonts, theme.fonts);
    else yTheme.set("fonts", Y.Array.from(theme.fonts.map((font) => cloneJson(font))));
    if (theme.modes === undefined) yTheme.delete("modes");
    else if (!jsonEqual(yTheme.get("modes"), theme.modes)) yTheme.set("modes", cloneJson(theme.modes));

    syncLeafMap(doc.getMap(YDOC_KEYS.assets), assets);
    syncLeafMap(doc.getMap(YDOC_KEYS.componentDeps), componentDeps);
    syncLeafMap(doc.getMap(YDOC_KEYS.dataSources), dataSources ?? {});
    syncArray(doc.getArray(YDOC_KEYS.pageOrder), pageOrder);

    const yNodes = doc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes);
    for (const id of [...yNodes.keys()]) if (!(id in nodes)) yNodes.delete(id);
    for (const [id, node] of Object.entries(nodes)) {
      const yNode = yNodes.get(id);
      if (!yNode || yNode.get("type") !== node.type) yNodes.set(id, nodeToYMap(node));
      else syncNode(yNode, node);
    }
  }, origin);
}

/** Y.Doc baru dari snapshot JSON (mis. fallback korupsi state). */
export function documentFromJsonSnapshot(json: SiteDocument, siteId?: string): Y.Doc {
  return jsonToYDoc(json, siteId ? createSiteYDoc(siteId) : new Y.Doc());
}
